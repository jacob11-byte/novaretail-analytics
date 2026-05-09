const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const db = require("./db");
require("dotenv").config();

const app = express();
const api = express.Router();

app.use(cors());
app.use(express.json());
app.use("/api/v1", api);

const PORT = process.env.PORT || 4000;
const ROLES = ["admin", "gerente", "supervisor", "vendedor", "bodega", "rrhh"];
const ADMIN_ROLES = ["admin"];
const MANAGEMENT_ROLES = ["admin", "gerente", "supervisor"];

function normalizeEmpresaIds(empresaId) {
  if (!empresaId || empresaId === "all") {
    return [];
  }

  return String(empresaId)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

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
      return res.status(401).json({ error: "Token invalido o expirado" });
    }
  };
}

async function obtenerEmpresasUsuario(usuarioId, rol) {
  if (rol === "admin") {
    const result = await db.query(
      "select id, nombre, nit, direccion, telefono, email, estado from empresas order by nombre asc"
    );

    return result.rows;
  }

  const result = await db.query(
    `
    select e.id, e.nombre, e.nit, e.direccion, e.telefono, e.email, e.estado, ue.rol
    from usuario_empresas ue
    join empresas e on e.id = ue.empresa_id
    where ue.usuario_id = $1 and e.estado = 'activa'
    order by e.nombre asc
    `,
    [usuarioId]
  );

  return result.rows;
}

async function resolverEmpresasPermitidas(req, res) {
  const empresasUsuario = await obtenerEmpresasUsuario(req.user.id, req.user.rol);
  const permitidas = empresasUsuario.map((empresa) => empresa.id);

  if (req.user.rol !== "admin" && permitidas.length === 0) {
    res.status(403).json({ error: "Usuario sin empresas asignadas" });
    return null;
  }

  const solicitadas = normalizeEmpresaIds(req.query.empresa_id);

  if (solicitadas.length === 0) {
    return req.user.rol === "admin" ? [] : permitidas;
  }

  if (req.user.rol === "admin") {
    return solicitadas;
  }

  const noPermitidas = solicitadas.filter((id) => !permitidas.includes(id));

  if (noPermitidas.length > 0) {
    res.status(403).json({ error: "Empresa no permitida para el usuario" });
    return null;
  }

  return solicitadas;
}

function empresaWhere(alias, empresaIds, startIndex) {
  if (!empresaIds || empresaIds.length === 0) {
    return { clause: "", params: [] };
  }

  const paramName = `$${startIndex}`;
  return {
    clause: ` and ${alias}.empresa_id = any(${paramName}::uuid[])`,
    params: [empresaIds],
  };
}

async function registrarAuditoria(usuarioId, accion, detalle, empresaId = null) {
  try {
    await db.query(
      "insert into auditoria (usuario_id, empresa_id, accion, modulo, detalle) values ($1, $2, $3, $4, $5)",
      [usuarioId, empresaId, accion, "ajustes", detalle]
    );
  } catch (error) {
    await db.query(
      "insert into auditoria (usuario_id, accion, detalle) values ($1, $2, $3)",
      [usuarioId, accion, detalle]
    );
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "NovaRetail Analytics API funcionando",
  });
});

api.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contrasena son requeridos" });
    }

    const result = await db.query(
      "select * from usuarios where lower(email)=lower($1) and activo=true",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await db.query(
        "update usuarios set intentos_fallidos = coalesce(intentos_fallidos, 0) + 1 where id = $1",
        [user.id]
      );
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    await db.query("update usuarios set intentos_fallidos = 0 where id = $1", [
      user.id,
    ]);

    const empresas = await obtenerEmpresasUsuario(user.id, user.rol);
    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await registrarAuditoria(user.id, "LOGIN_EXITOSO", "Inicio de sesion correcto");

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        empresas,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

api.get("/auth/me", authMiddleware(), async (req, res) => {
  try {
    const result = await db.query(
      "select id, nombre, email, rol, activo from usuarios where id=$1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const empresas = await obtenerEmpresasUsuario(req.user.id, req.user.rol);

    res.json({
      user: {
        ...result.rows[0],
        empresas,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al cargar usuario" });
  }
});

api.get("/empresas", authMiddleware(), async (req, res) => {
  try {
    const empresas = await obtenerEmpresasUsuario(req.user.id, req.user.rol);
    res.json({ total: empresas.length, empresas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener empresas" });
  }
});

api.post("/empresas", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { nombre, nit, direccion, telefono, email, estado = "activa" } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre de la empresa es requerido" });
    }

    const result = await db.query(
      `
      insert into empresas (nombre, nit, direccion, telefono, email, estado)
      values ($1, $2, $3, $4, $5, $6)
      returning id, nombre, nit, direccion, telefono, email, estado, created_at, updated_at
      `,
      [nombre, nit, direccion, telefono, email, estado]
    );

    await db.query(
      "insert into usuario_empresas (usuario_id, empresa_id, rol) values ($1, $2, $3) on conflict do nothing",
      [req.user.id, result.rows[0].id, "admin"]
    );
    await registrarAuditoria(
      req.user.id,
      "EMPRESA_CREADA",
      `Empresa creada: ${nombre}`,
      result.rows[0].id
    );

    res.status(201).json({ empresa: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear empresa" });
  }
});

api.put("/empresas/:id", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { nombre, nit, direccion, telefono, email, estado } = req.body;
    const result = await db.query(
      `
      update empresas
      set nombre = coalesce($1, nombre),
          nit = $2,
          direccion = $3,
          telefono = $4,
          email = $5,
          estado = coalesce($6, estado),
          updated_at = now()
      where id = $7
      returning id, nombre, nit, direccion, telefono, email, estado, created_at, updated_at
      `,
      [nombre, nit, direccion, telefono, email, estado, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    await registrarAuditoria(
      req.user.id,
      "EMPRESA_ACTUALIZADA",
      `Empresa actualizada: ${result.rows[0].nombre}`,
      result.rows[0].id
    );

    res.json({ empresa: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar empresa" });
  }
});

api.delete("/empresas/:id", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await db.query(
      `
      update empresas
      set estado = 'inactiva', updated_at = now()
      where id = $1
      returning id, nombre, estado
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    await registrarAuditoria(
      req.user.id,
      "EMPRESA_DESACTIVADA",
      `Empresa desactivada: ${result.rows[0].nombre}`,
      result.rows[0].id
    );

    res.json({ empresa: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al desactivar empresa" });
  }
});

api.get("/usuarios", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await db.query(
      `
      select id, nombre, email, rol, activo, intentos_fallidos, created_at, updated_at
      from usuarios
      order by nombre asc
      `
    );

    const empresas = await db.query(
      `
      select ue.usuario_id, ue.empresa_id, ue.rol, e.nombre as empresa
      from usuario_empresas ue
      join empresas e on e.id = ue.empresa_id
      order by e.nombre asc
      `
    );

    const usuarios = result.rows.map((usuario) => ({
      ...usuario,
      empresas: empresas.rows.filter((empresa) => empresa.usuario_id === usuario.id),
    }));

    res.json({ total: usuarios.length, usuarios });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

api.post("/usuarios", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const {
      nombre,
      email,
      password,
      rol = "vendedor",
      activo = true,
      empresas = [],
    } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "Nombre, email y contrasena son requeridos" });
    }

    if (!ROLES.includes(rol)) {
      return res.status(400).json({ error: "Rol no permitido" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `
      insert into usuarios (nombre, email, password_hash, rol, activo)
      values ($1, lower($2), $3, $4, $5)
      returning id, nombre, email, rol, activo, created_at, updated_at
      `,
      [nombre, email, passwordHash, rol, activo]
    );

    for (const empresaId of empresas) {
      await db.query(
        "insert into usuario_empresas (usuario_id, empresa_id, rol) values ($1, $2, $3) on conflict (usuario_id, empresa_id) do update set rol = excluded.rol",
        [result.rows[0].id, empresaId, rol]
      );
    }

    await registrarAuditoria(
      req.user.id,
      "USUARIO_CREADO",
      `Usuario creado: ${result.rows[0].email}`
    );

    res.status(201).json({ usuario: result.rows[0] });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({ error: "El email ya existe" });
    }

    res.status(500).json({ error: "Error al crear usuario" });
  }
});

api.put("/usuarios/:id", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { nombre, email, rol, activo } = req.body;

    if (rol && !ROLES.includes(rol)) {
      return res.status(400).json({ error: "Rol no permitido" });
    }

    const result = await db.query(
      `
      update usuarios
      set nombre = coalesce($1, nombre),
          email = coalesce(lower($2), email),
          rol = coalesce($3, rol),
          activo = coalesce($4, activo),
          updated_at = now()
      where id = $5
      returning id, nombre, email, rol, activo, intentos_fallidos, created_at, updated_at
      `,
      [nombre, email, rol, activo, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await registrarAuditoria(
      req.user.id,
      "USUARIO_ACTUALIZADO",
      `Usuario actualizado: ${result.rows[0].email}`
    );

    res.json({ usuario: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

api.delete("/usuarios/:id", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await db.query(
      "update usuarios set activo=false, updated_at=now() where id=$1 returning id, nombre, email, activo",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await registrarAuditoria(
      req.user.id,
      "USUARIO_DESACTIVADO",
      `Usuario desactivado: ${result.rows[0].email}`
    );

    res.json({ usuario: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al desactivar usuario" });
  }
});

api.put("/usuarios/:id/password", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      "update usuarios set password_hash=$1, updated_at=now() where id=$2 returning id, email",
      [passwordHash, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ message: "Contrasena actualizada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar contrasena" });
  }
});

api.get("/usuarios/:id/empresas", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await db.query(
      `
      select ue.id, ue.usuario_id, ue.empresa_id, ue.rol, e.nombre as empresa
      from usuario_empresas ue
      join empresas e on e.id = ue.empresa_id
      where ue.usuario_id = $1
      order by e.nombre asc
      `,
      [req.params.id]
    );

    res.json({ total: result.rows.length, empresas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener empresas del usuario" });
  }
});

api.post("/usuarios/:id/empresas", authMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { empresas = [], rol = "vendedor" } = req.body;

    if (!Array.isArray(empresas)) {
      return res.status(400).json({ error: "Empresas debe ser un arreglo" });
    }

    if (!ROLES.includes(rol)) {
      return res.status(400).json({ error: "Rol no permitido" });
    }

    await db.query("delete from usuario_empresas where usuario_id=$1", [
      req.params.id,
    ]);

    for (const empresaId of empresas) {
      await db.query(
        "insert into usuario_empresas (usuario_id, empresa_id, rol) values ($1, $2, $3)",
        [req.params.id, empresaId, rol]
      );
    }

    await registrarAuditoria(
      req.user.id,
      "USUARIO_EMPRESAS_ACTUALIZADAS",
      `Empresas actualizadas para usuario ${req.params.id}`
    );

    res.json({ message: "Empresas asignadas correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al asignar empresas" });
  }
});

api.get("/roles", authMiddleware(ADMIN_ROLES), (req, res) => {
  res.json({
    roles: ROLES.map((rol) => ({
      id: rol,
      nombre: rol,
    })),
  });
});

api.get("/dashboard", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { fecha_i, fecha_f, canal = "todos" } = req.query;
    const fechaInicio = fecha_i || "2026-01-01";
    const fechaFin = fecha_f || "2026-12-31";
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const ventasEmpresa = empresaWhere("v", empresaIds, 4);
    const inventarioEmpresa = empresaWhere("i", empresaIds, 1);

    const ventas = await db.query(
      `
      select coalesce(sum(v.cantidad * v.precio_unitario), 0) as ventas_totales
      from ventas v
      where v.fecha between $1 and $2
      and ($3 = 'todos' or v.canal = $3)
      ${ventasEmpresa.clause}
      `,
      [fechaInicio, fechaFin, canal, ...ventasEmpresa.params]
    );

    const canalesEmpresa = empresaWhere("v", empresaIds, 3);
    const canales = await db.query(
      `
      select v.canal, coalesce(sum(v.cantidad * v.precio_unitario), 0) as total
      from ventas v
      where v.fecha between $1 and $2
      ${canalesEmpresa.clause}
      group by v.canal
      order by total desc
      `,
      [fechaInicio, fechaFin, ...canalesEmpresa.params]
    );

    const productosEmpresa = empresaWhere("v", empresaIds, 3);
    const topProductos = await db.query(
      `
      select v.cod_producto, sum(v.cantidad) as total_vendido
      from ventas v
      where v.fecha between $1 and $2
      ${productosEmpresa.clause}
      group by v.cod_producto
      order by total_vendido desc
      limit 10
      `,
      [fechaInicio, fechaFin, ...productosEmpresa.params]
    );

    const alertas = await db.query(
      `
      select count(*) as total
      from inventario i
      join productos p on p.cod_producto = i.cod_producto
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where i.stock_fisico < coalesce(p.stock_minimo, 10)
      ${inventarioEmpresa.clause}
      `,
      [...inventarioEmpresa.params]
    );

    res.json({
      ventas_totales: Number(ventas.rows[0].ventas_totales),
      comparativa_canales: canales.rows,
      top_productos: topProductos.rows,
      alertas_count: Number(alertas.rows[0].total),
      empresas_filtradas: empresaIds,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al cargar dashboard" });
  }
});

api.get("/alertas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("i", empresaIds, 1);
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
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where i.stock_fisico < coalesce(p.stock_minimo, 10)
      ${filtroEmpresa.clause}
      order by i.stock_fisico asc
      `,
      [...filtroEmpresa.params]
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
});

api.get("/ventas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("v", empresaIds, 1);
    const result = await db.query(
      `
      select
        v.id,
        v.fecha,
        v.cod_producto,
        coalesce(p.nombre, 'Producto no registrado') as producto,
        v.canal,
        v.cantidad,
        v.precio_unitario,
        (v.cantidad * v.precio_unitario) as total
      from ventas v
      left join productos p on p.cod_producto = v.cod_producto
        and (p.empresa_id = v.empresa_id or p.empresa_id is null or v.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by v.fecha desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({
      total: result.rows.length,
      ventas: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener ventas" });
  }
});

api.get("/inventario", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("i", empresaIds, 1);
    const result = await db.query(
      `
      select
        i.id,
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
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by p.cod_producto asc
      `,
      [...filtroEmpresa.params]
    );

    res.json({
      total: result.rows.length,
      inventario: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener inventario" });
  }
});

api.get("/reportes/ventas-xlsx", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("v", empresaIds, 1);
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
        and (p.empresa_id = v.empresa_id or p.empresa_id is null or v.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by v.fecha desc
      `,
      [...filtroEmpresa.params]
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

    await registrarAuditoria(req.user.id, "REPORTE_VENTAS_EXPORTADO", "Reporte de ventas exportado");

    res.setHeader("Content-Disposition", "attachment; filename=reporte_ventas.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de ventas" });
  }
});

api.get("/reportes/inventario-xlsx", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("i", empresaIds, 1);
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
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by p.cod_producto asc
      `,
      [...filtroEmpresa.params]
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

    await registrarAuditoria(
      req.user.id,
      "REPORTE_INVENTARIO_EXPORTADO",
      "Reporte de inventario exportado"
    );

    res.setHeader("Content-Disposition", "attachment; filename=reporte_inventario.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de inventario" });
  }
});

app.listen(PORT, () => {
  console.log(`API NovaRetail ejecutandose en puerto ${PORT}`);
});
