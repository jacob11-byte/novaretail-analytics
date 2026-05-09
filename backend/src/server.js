const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const db = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

function authMiddleware(rolesPermitidos = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const token = header.replace("Bearer ", "");

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);

      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(user.rol)) {
        return res.status(403).json({ error: "No tiene permisos suficientes" });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "NovaRetail Analytics API funcionando",
  });
});

app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      "select * from usuarios where email=$1 and activo=true",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await db.query(
      "insert into auditoria (usuario_id, accion, detalle) values ($1, $2, $3)",
      [user.id, "LOGIN_EXITOSO", "Inicio de sesión correcto"]
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get(
  "/api/v1/dashboard",
  authMiddleware(["admin", "gerente", "supervisor"]),
  async (req, res) => {
    try {
      const { fecha_i, fecha_f, canal = "todos" } = req.query;

      const fechaInicio = fecha_i || "2026-01-01";
      const fechaFin = fecha_f || "2026-12-31";

      const ventas = await db.query(
        `
        select coalesce(sum(cantidad * precio_unitario), 0) as ventas_totales
        from ventas
        where fecha between $1 and $2
        and ($3 = 'todos' or canal = $3)
        `,
        [fechaInicio, fechaFin, canal]
      );

      const canales = await db.query(
        `
        select canal, coalesce(sum(cantidad * precio_unitario), 0) as total
        from ventas
        where fecha between $1 and $2
        group by canal
        order by total desc
        `,
        [fechaInicio, fechaFin]
      );

      const topProductos = await db.query(
        `
        select cod_producto, sum(cantidad) as total_vendido
        from ventas
        where fecha between $1 and $2
        group by cod_producto
        order by total_vendido desc
        limit 10
        `,
        [fechaInicio, fechaFin]
      );

      const alertas = await db.query(
        `
        select count(*) as total
        from inventario i
        join productos p on p.cod_producto = i.cod_producto
        where i.stock_fisico < coalesce(p.stock_minimo, 10)
        `
      );

      res.json({
        ventas_totales: Number(ventas.rows[0].ventas_totales),
        comparativa_canales: canales.rows,
        top_productos: topProductos.rows,
        alertas_count: Number(alertas.rows[0].total),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al cargar dashboard" });
    }
  }
);

app.get(
  "/api/v1/alertas",
  authMiddleware(["admin", "gerente", "supervisor"]),
  async (req, res) => {
    try {
      const result = await db.query(
        `
        select 
          i.id,
          i.cod_producto,
          p.nombre,
          i.stock_fisico as stock_actual,
          coalesce(p.stock_minimo, 10) as stock_minimo,
          case 
            when i.stock_fisico = 0 then 'CRITICA'
            when i.stock_fisico < coalesce(p.stock_minimo, 10) * 0.5 then 'ALTA'
            else 'MEDIA'
          end as severidad
        from inventario i
        join productos p on p.cod_producto = i.cod_producto
        where i.stock_fisico < coalesce(p.stock_minimo, 10)
        order by i.stock_fisico asc
        `
      );

      res.json({
        total: result.rows.length,
        alertas: result.rows.map((item) => ({
          ...item,
          tipo: "stock_critico",
        })),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al cargar alertas" });
    }
  }
);
app.get(
  "/api/v1/reportes/ventas-xlsx",
  authMiddleware(["admin", "gerente", "supervisor"]),
  async (req, res) => {
    try {
      const result = await db.query(
        `
        select 
          v.fecha,
          v.cod_producto,
          coalesce(p.nombre, 'Producto no registrado') as producto,
          v.canal,
          v.cantidad,
          v.precio_unitario,
          (v.cantidad * v.precio_unitario) as total
        from ventas v
        left join productos p on p.cod_producto = v.cod_producto
        order by v.fecha desc
        `
      );

      const data = result.rows.map((row) => ({
        Fecha: row.fecha,
        Codigo: row.cod_producto,
        Producto: row.producto,
        Canal: row.canal,
        Cantidad: Number(row.cantidad),
        "Precio unitario": Number(row.precio_unitario),
        Total: Number(row.total),
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=reporte_ventas.xlsx"
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.send(buffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al generar reporte de ventas" });
    }
  }
);

app.get(
  "/api/v1/reportes/inventario-xlsx",
  authMiddleware(["admin", "gerente", "supervisor"]),
  async (req, res) => {
    try {
      const result = await db.query(
        `
        select 
          p.cod_producto,
          p.nombre,
          p.categoria,
          i.stock_fisico,
          i.stock_reportado,
          p.stock_minimo,
          case 
            when i.stock_fisico = 0 then 'CRITICA'
            when i.stock_fisico < coalesce(p.stock_minimo, 10) then 'ALERTA'
            else 'NORMAL'
          end as estado
        from inventario i
        join productos p on p.cod_producto = i.cod_producto
        order by p.cod_producto asc
        `
      );

      const data = result.rows.map((row) => ({
        Codigo: row.cod_producto,
        Producto: row.nombre,
        Categoria: row.categoria,
        "Stock fisico": Number(row.stock_fisico),
        "Stock reportado": Number(row.stock_reportado),
        "Stock minimo": Number(row.stock_minimo),
        Estado: row.estado,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=reporte_inventario.xlsx"
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.send(buffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al generar reporte de inventario" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`API NovaRetail ejecutándose en puerto ${PORT}`);
});