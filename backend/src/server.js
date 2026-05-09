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

async function validarEmpresaPermitida(req, res, empresaId) {
  if (!empresaId) {
    res.status(400).json({ error: "empresa_id es requerido" });
    return false;
  }

  if (req.user.rol === "admin") {
    return true;
  }

  const empresas = await obtenerEmpresasUsuario(req.user.id, req.user.rol);
  const permitida = empresas.some((empresa) => empresa.id === empresaId);

  if (!permitida) {
    res.status(403).json({ error: "Empresa no permitida para el usuario" });
    return false;
  }

  return true;
}

function calcularLineas(lineas = []) {
  const detalle = lineas.map((linea) => {
    const cantidad = Number(linea.cantidad || 0);
    const precioUnitario = Number(linea.precio_unitario || 0);
    const impuestoPorcentaje = Number(linea.impuesto_porcentaje ?? 12);
    const subtotal = Number((cantidad * precioUnitario).toFixed(2));
    const impuesto = Number(((subtotal * impuestoPorcentaje) / 100).toFixed(2));

    return {
      producto_id: linea.producto_id || null,
      descripcion: linea.descripcion || "",
      cantidad,
      unidad: linea.unidad || "unidad",
      precio_unitario: precioUnitario,
      impuesto_porcentaje: impuestoPorcentaje,
      subtotal,
      impuesto,
    };
  });

  const subtotal = Number(
    detalle.reduce((total, linea) => total + linea.subtotal, 0).toFixed(2)
  );
  const impuestos = Number(
    detalle.reduce((total, linea) => total + linea.impuesto, 0).toFixed(2)
  );

  return {
    detalle,
    subtotal,
    impuestos,
    total: Number((subtotal + impuestos).toFixed(2)),
  };
}

function calcularVentaPos(items = [], descuento = 0) {
  const detalle = items.map((item) => {
    const cantidad = Number(item.cantidad || 0);
    const precioUnitario = Number(item.precio_unitario || 0);
    const subtotal = Number((cantidad * precioUnitario).toFixed(2));

    return {
      producto_id: item.producto_id || item.cod_producto || null,
      cod_producto: item.cod_producto || item.producto_id || null,
      descripcion: item.descripcion || item.nombre || "",
      cantidad,
      precio_unitario: precioUnitario,
      subtotal,
    };
  });
  const subtotal = Number(
    detalle.reduce((total, item) => total + item.subtotal, 0).toFixed(2)
  );
  const descuentoAplicado = Math.min(Number(descuento || 0), subtotal);
  const baseImpuesto = Math.max(subtotal - descuentoAplicado, 0);
  const impuestos = Number((baseImpuesto * 0.12).toFixed(2));

  return {
    detalle,
    subtotal,
    descuento: Number(descuentoAplicado.toFixed(2)),
    impuestos,
    total: Number((baseImpuesto + impuestos).toFixed(2)),
  };
}

function calcularCompraLineas(lineas = []) {
  const detalle = lineas.map((linea) => {
    const cantidad = Number(linea.cantidad || 0);
    const costoUnitario = Number(linea.costo_unitario || 0);
    const subtotal = Number((cantidad * costoUnitario).toFixed(2));

    return {
      producto_id: linea.producto_id || linea.cod_producto || null,
      cod_producto: linea.cod_producto || linea.producto_id || null,
      descripcion: linea.descripcion || "",
      cantidad,
      costo_unitario: costoUnitario,
      subtotal,
    };
  });
  const subtotal = Number(
    detalle.reduce((total, linea) => total + linea.subtotal, 0).toFixed(2)
  );
  const impuestos = Number((subtotal * 0.12).toFixed(2));

  return {
    detalle,
    subtotal,
    impuestos,
    total: Number((subtotal + impuestos).toFixed(2)),
  };
}

async function generarNumeroDocumento(tabla, prefijo, empresaId) {
  const result = await db.query(
    `select count(*)::int as total from ${tabla} where empresa_id = $1`,
    [empresaId]
  );
  const siguiente = Number(result.rows[0].total) + 1;

  return `${prefijo}-${String(siguiente).padStart(5, "0")}`;
}

async function registrarMovimientoInventario(
  queryable,
  {
    empresaId,
    codProducto,
    tipoMovimiento,
    referencia,
    cantidad,
    stockAnterior,
    stockNuevo,
    usuarioId,
  }
) {
  await queryable.query(
    `
    insert into movimientos_inventario (
      empresa_id, producto_id, cod_producto, tipo_movimiento, referencia,
      cantidad, stock_anterior, stock_nuevo, usuario_id
    )
    values ($1, $2, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      empresaId,
      codProducto,
      tipoMovimiento,
      referencia || null,
      cantidad,
      stockAnterior,
      stockNuevo,
      String(usuarioId),
    ]
  );
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function diasEntreFechas(fechaInicio, fechaFin) {
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);
  const diff = fin.getTime() - inicio.getTime();

  return Math.max(Math.floor(diff / 86400000) + 1, 0);
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

api.get("/clientes", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("c", empresaIds, 1);
    const result = await db.query(
      `
      select c.id, c.empresa_id, e.nombre as empresa, c.nombre, c.nit,
        c.telefono, c.email, c.direccion, c.estado, c.created_at, c.updated_at
      from clientes c
      join empresas e on e.id = c.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by c.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, clientes: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

api.post("/clientes", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const {
      empresa_id,
      nombre,
      nit,
      telefono,
      email,
      direccion,
      estado = "activo",
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del cliente es requerido" });
    }

    const result = await db.query(
      `
      insert into clientes (empresa_id, nombre, nit, telefono, email, direccion, estado)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, empresa_id, nombre, nit, telefono, email, direccion, estado, created_at
      `,
      [empresa_id, nombre, nit, telefono, email, direccion, estado]
    );

    await registrarAuditoria(
      req.user.id,
      "CLIENTE_CREADO",
      `Cliente creado: ${nombre}`,
      empresa_id
    );

    res.status(201).json({ cliente: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

api.put("/clientes/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const actual = await db.query("select empresa_id from clientes where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
      return;
    }

    const { nombre, nit, telefono, email, direccion, estado } = req.body;
    const result = await db.query(
      `
      update clientes
      set nombre = coalesce($1, nombre),
          nit = $2,
          telefono = $3,
          email = $4,
          direccion = $5,
          estado = coalesce($6, estado),
          updated_at = now()
      where id = $7
      returning id, empresa_id, nombre, nit, telefono, email, direccion, estado, updated_at
      `,
      [nombre, nit, telefono, email, direccion, estado, req.params.id]
    );

    await registrarAuditoria(
      req.user.id,
      "CLIENTE_ACTUALIZADO",
      `Cliente actualizado: ${result.rows[0].nombre}`,
      result.rows[0].empresa_id
    );

    res.json({ cliente: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

api.get("/cotizaciones", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("c", empresaIds, 1);
    const result = await db.query(
      `
      select c.id, c.empresa_id, e.nombre as empresa, c.numero, c.cliente_id,
        coalesce(cl.nombre, 'Cliente no registrado') as cliente,
        c.fecha_creacion, c.fecha_vencimiento, c.estado, c.subtotal,
        c.impuestos, c.total, c.created_at
      from cotizaciones c
      join empresas e on e.id = c.empresa_id
      left join clientes cl on cl.id = c.cliente_id
      where true
      ${filtroEmpresa.clause}
      order by c.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, cotizaciones: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener cotizaciones" });
  }
});

api.post("/cotizaciones", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      numero,
      cliente_id,
      fecha_creacion,
      fecha_vencimiento,
      lista_precios,
      terminos_pago,
      estado = "cotizacion",
      lineas = [],
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    const calculo = calcularLineas(lineas);
    const numeroDocumento =
      numero || (await generarNumeroDocumento("cotizaciones", "COT", empresa_id));

    await client.query("begin");
    const cotizacion = await client.query(
      `
      insert into cotizaciones (
        empresa_id, numero, cliente_id, vendedor_id, fecha_creacion,
        fecha_vencimiento, lista_precios, terminos_pago, estado,
        subtotal, impuestos, total
      )
      values ($1, $2, $3, $4, coalesce($5, current_date), $6, $7, $8, $9, $10, $11, $12)
      returning *
      `,
      [
        empresa_id,
        numeroDocumento,
        cliente_id || null,
        String(req.user.id),
        fecha_creacion || null,
        fecha_vencimiento || null,
        lista_precios || null,
        terminos_pago || null,
        estado,
        calculo.subtotal,
        calculo.impuestos,
        calculo.total,
      ]
    );

    for (const linea of calculo.detalle) {
      await client.query(
        `
        insert into cotizacion_detalle (
          cotizacion_id, producto_id, descripcion, cantidad, unidad,
          precio_unitario, impuesto_porcentaje, subtotal
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          cotizacion.rows[0].id,
          linea.producto_id,
          linea.descripcion,
          linea.cantidad,
          linea.unidad,
          linea.precio_unitario,
          linea.impuesto_porcentaje,
          linea.subtotal,
        ]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "COTIZACION_CREADA",
      `Cotizacion creada: ${numeroDocumento}`,
      empresa_id
    );

    res.status(201).json({ cotizacion: cotizacion.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al crear cotizacion" });
  } finally {
    client.release();
  }
});

api.get("/cotizaciones/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const cotizacion = await db.query(
      `
      select c.*, coalesce(cl.nombre, 'Cliente no registrado') as cliente
      from cotizaciones c
      left join clientes cl on cl.id = c.cliente_id
      where c.id = $1
      `,
      [req.params.id]
    );

    if (cotizacion.rows.length === 0) {
      return res.status(404).json({ error: "Cotizacion no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, cotizacion.rows[0].empresa_id))) {
      return;
    }

    const detalle = await db.query(
      "select * from cotizacion_detalle where cotizacion_id=$1 order by id asc",
      [req.params.id]
    );

    res.json({ cotizacion: { ...cotizacion.rows[0], lineas: detalle.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener cotizacion" });
  }
});

api.put("/cotizaciones/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const actual = await db.query("select * from cotizaciones where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Cotizacion no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
      return;
    }

    const {
      cliente_id,
      fecha_creacion,
      fecha_vencimiento,
      lista_precios,
      terminos_pago,
      estado,
      lineas,
    } = req.body;
    const calculo = Array.isArray(lineas) ? calcularLineas(lineas) : null;

    await client.query("begin");
    const cotizacion = await client.query(
      `
      update cotizaciones
      set cliente_id = coalesce($1, cliente_id),
          fecha_creacion = coalesce($2, fecha_creacion),
          fecha_vencimiento = $3,
          lista_precios = $4,
          terminos_pago = $5,
          estado = coalesce($6, estado),
          subtotal = coalesce($7, subtotal),
          impuestos = coalesce($8, impuestos),
          total = coalesce($9, total),
          updated_at = now()
      where id = $10
      returning *
      `,
      [
        cliente_id || null,
        fecha_creacion || null,
        fecha_vencimiento || null,
        lista_precios || null,
        terminos_pago || null,
        estado || null,
        calculo?.subtotal ?? null,
        calculo?.impuestos ?? null,
        calculo?.total ?? null,
        req.params.id,
      ]
    );

    if (calculo) {
      await client.query("delete from cotizacion_detalle where cotizacion_id=$1", [
        req.params.id,
      ]);

      for (const linea of calculo.detalle) {
        await client.query(
          `
          insert into cotizacion_detalle (
            cotizacion_id, producto_id, descripcion, cantidad, unidad,
            precio_unitario, impuesto_porcentaje, subtotal
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            req.params.id,
            linea.producto_id,
            linea.descripcion,
            linea.cantidad,
            linea.unidad,
            linea.precio_unitario,
            linea.impuesto_porcentaje,
            linea.subtotal,
          ]
        );
      }
    }

    await client.query("commit");
    res.json({ cotizacion: cotizacion.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al actualizar cotizacion" });
  } finally {
    client.release();
  }
});

api.post(
  "/cotizaciones/:id/confirmar",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    const client = await db.connect();

    try {
      const cotizacion = await db.query("select * from cotizaciones where id=$1", [
        req.params.id,
      ]);

      if (cotizacion.rows.length === 0) {
        return res.status(404).json({ error: "Cotizacion no encontrada" });
      }

      const cotizacionActual = cotizacion.rows[0];

      if (!(await validarEmpresaPermitida(req, res, cotizacionActual.empresa_id))) {
        return;
      }

      const detalle = await db.query(
        "select * from cotizacion_detalle where cotizacion_id=$1 order by id asc",
        [req.params.id]
      );
      const numeroOrden = await generarNumeroDocumento(
        "ordenes_venta",
        "OV",
        cotizacionActual.empresa_id
      );

      await client.query("begin");
      const orden = await client.query(
        `
        insert into ordenes_venta (
          empresa_id, numero, cotizacion_id, cliente_id, vendedor_id,
          fecha_orden, estado, subtotal, impuestos, total, orden_despacho
        )
        values ($1, $2, $3, $4, $5, current_date, 'orden_venta', $6, $7, $8, $9)
        returning *
        `,
        [
          cotizacionActual.empresa_id,
          numeroOrden,
          cotizacionActual.id,
          cotizacionActual.cliente_id,
          cotizacionActual.vendedor_id,
          cotizacionActual.subtotal,
          cotizacionActual.impuestos,
          cotizacionActual.total,
          req.body.orden_despacho || null,
        ]
      );

      for (const linea of detalle.rows) {
        await client.query(
          `
          insert into orden_venta_detalle (
            orden_venta_id, producto_id, descripcion, cantidad, unidad,
            precio_unitario, impuesto_porcentaje, subtotal
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            orden.rows[0].id,
            linea.producto_id,
            linea.descripcion,
            linea.cantidad,
            linea.unidad,
            linea.precio_unitario,
            linea.impuesto_porcentaje,
            linea.subtotal,
          ]
        );
      }

      await client.query(
        "update cotizaciones set estado='orden_venta', updated_at=now() where id=$1",
        [req.params.id]
      );
      await client.query("commit");

      await registrarAuditoria(
        req.user.id,
        "COTIZACION_CONFIRMADA",
        `Cotizacion confirmada: ${cotizacionActual.numero}`,
        cotizacionActual.empresa_id
      );

      res.status(201).json({ orden: orden.rows[0] });
    } catch (error) {
      await client.query("rollback");
      console.error(error);
      res.status(500).json({ error: "Error al confirmar cotizacion" });
    } finally {
      client.release();
    }
  }
);

api.get("/ordenes-venta", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("o", empresaIds, 1);
    const result = await db.query(
      `
      select o.id, o.empresa_id, e.nombre as empresa, o.numero, o.cotizacion_id,
        o.cliente_id, coalesce(cl.nombre, 'Cliente no registrado') as cliente,
        o.fecha_orden, o.estado, o.subtotal, o.impuestos, o.total,
        o.orden_despacho, o.created_at
      from ordenes_venta o
      join empresas e on e.id = o.empresa_id
      left join clientes cl on cl.id = o.cliente_id
      where true
      ${filtroEmpresa.clause}
      order by o.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, ordenes: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener ordenes de venta" });
  }
});

api.post("/ordenes-venta", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      numero,
      cliente_id,
      fecha_orden,
      estado = "orden_venta",
      orden_despacho,
      lineas = [],
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    const calculo = calcularLineas(lineas);
    const numeroDocumento =
      numero || (await generarNumeroDocumento("ordenes_venta", "OV", empresa_id));

    await client.query("begin");
    const orden = await client.query(
      `
      insert into ordenes_venta (
        empresa_id, numero, cliente_id, vendedor_id, fecha_orden, estado,
        subtotal, impuestos, total, orden_despacho
      )
      values ($1, $2, $3, $4, coalesce($5, current_date), $6, $7, $8, $9, $10)
      returning *
      `,
      [
        empresa_id,
        numeroDocumento,
        cliente_id || null,
        String(req.user.id),
        fecha_orden || null,
        estado,
        calculo.subtotal,
        calculo.impuestos,
        calculo.total,
        orden_despacho || null,
      ]
    );

    for (const linea of calculo.detalle) {
      await client.query(
        `
        insert into orden_venta_detalle (
          orden_venta_id, producto_id, descripcion, cantidad, unidad,
          precio_unitario, impuesto_porcentaje, subtotal
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          orden.rows[0].id,
          linea.producto_id,
          linea.descripcion,
          linea.cantidad,
          linea.unidad,
          linea.precio_unitario,
          linea.impuesto_porcentaje,
          linea.subtotal,
        ]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "ORDEN_VENTA_CREADA",
      `Orden de venta creada: ${numeroDocumento}`,
      empresa_id
    );

    res.status(201).json({ orden: orden.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al crear orden de venta" });
  } finally {
    client.release();
  }
});

api.get("/ordenes-venta/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const orden = await db.query(
      `
      select o.*, coalesce(cl.nombre, 'Cliente no registrado') as cliente
      from ordenes_venta o
      left join clientes cl on cl.id = o.cliente_id
      where o.id = $1
      `,
      [req.params.id]
    );

    if (orden.rows.length === 0) {
      return res.status(404).json({ error: "Orden de venta no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, orden.rows[0].empresa_id))) {
      return;
    }

    const detalle = await db.query(
      "select * from orden_venta_detalle where orden_venta_id=$1 order by id asc",
      [req.params.id]
    );

    res.json({ orden: { ...orden.rows[0], lineas: detalle.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener orden de venta" });
  }
});

api.put("/ordenes-venta/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const actual = await db.query("select * from ordenes_venta where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Orden de venta no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
      return;
    }

    const { cliente_id, fecha_orden, estado, orden_despacho, lineas } = req.body;
    const calculo = Array.isArray(lineas) ? calcularLineas(lineas) : null;

    await client.query("begin");
    const orden = await client.query(
      `
      update ordenes_venta
      set cliente_id = coalesce($1, cliente_id),
          fecha_orden = coalesce($2, fecha_orden),
          estado = coalesce($3, estado),
          orden_despacho = $4,
          subtotal = coalesce($5, subtotal),
          impuestos = coalesce($6, impuestos),
          total = coalesce($7, total),
          updated_at = now()
      where id = $8
      returning *
      `,
      [
        cliente_id || null,
        fecha_orden || null,
        estado || null,
        orden_despacho || null,
        calculo?.subtotal ?? null,
        calculo?.impuestos ?? null,
        calculo?.total ?? null,
        req.params.id,
      ]
    );

    if (calculo) {
      await client.query("delete from orden_venta_detalle where orden_venta_id=$1", [
        req.params.id,
      ]);

      for (const linea of calculo.detalle) {
        await client.query(
          `
          insert into orden_venta_detalle (
            orden_venta_id, producto_id, descripcion, cantidad, unidad,
            precio_unitario, impuesto_porcentaje, subtotal
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            req.params.id,
            linea.producto_id,
            linea.descripcion,
            linea.cantidad,
            linea.unidad,
            linea.precio_unitario,
            linea.impuesto_porcentaje,
            linea.subtotal,
          ]
        );
      }
    }

    await client.query("commit");
    res.json({ orden: orden.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al actualizar orden de venta" });
  } finally {
    client.release();
  }
});

api.post(
  "/ordenes-venta/:id/cancelar",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const actual = await db.query("select * from ordenes_venta where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Orden de venta no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
        return;
      }

      const result = await db.query(
        "update ordenes_venta set estado='cancelado', updated_at=now() where id=$1 returning *",
        [req.params.id]
      );

      await registrarAuditoria(
        req.user.id,
        "ORDEN_VENTA_CANCELADA",
        `Orden de venta cancelada: ${result.rows[0].numero}`,
        result.rows[0].empresa_id
      );

      res.json({ orden: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al cancelar orden de venta" });
    }
  }
);

api.get("/pos/productos", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { q = "" } = req.query;
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("p", empresaIds, 2);
    const result = await db.query(
      `
      select
        p.cod_producto,
        p.nombre,
        p.categoria,
        p.empresa_id,
        coalesce(i.stock_fisico, 0) as stock_fisico,
        coalesce((
          select avg(v.precio_unitario)
          from ventas v
          where v.cod_producto = p.cod_producto
            and (v.empresa_id = p.empresa_id or v.empresa_id is null or p.empresa_id is null)
        ), 0) as precio_unitario
      from productos p
      left join inventario i on i.cod_producto = p.cod_producto
        and (i.empresa_id = p.empresa_id or i.empresa_id is null or p.empresa_id is null)
      where ($1 = '' or p.cod_producto ilike '%' || $1 || '%' or p.nombre ilike '%' || $1 || '%')
      ${filtroEmpresa.clause}
      order by p.nombre asc
      limit 50
      `,
      [q, ...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, productos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar productos POS" });
  }
});

api.post("/pos/venta", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      items = [],
      descuento = 0,
      metodo_pago = "efectivo",
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "La venta requiere productos" });
    }

    const venta = calcularVentaPos(items, descuento);

    await client.query("begin");

    for (const item of venta.detalle) {
      const inventario = await client.query(
        `
        select id, stock_fisico
        from inventario
        where empresa_id = $1 and cod_producto = $2
        for update
        `,
        [empresa_id, item.cod_producto]
      );

      if (inventario.rows.length === 0) {
        throw new Error(`Producto sin inventario: ${item.cod_producto}`);
      }

      const stockActual = Number(inventario.rows[0].stock_fisico);
      const stockNuevo = stockActual - item.cantidad;

      if (stockActual < item.cantidad) {
        throw new Error(`Stock insuficiente para ${item.cod_producto}`);
      }

      await client.query(
        "update inventario set stock_fisico = stock_fisico - $1 where id = $2",
        [item.cantidad, inventario.rows[0].id]
      );

      await registrarMovimientoInventario(client, {
        empresaId: empresa_id,
        codProducto: item.cod_producto,
        tipoMovimiento: "salida_venta",
        referencia: "punto_venta",
        cantidad: item.cantidad * -1,
        stockAnterior: stockActual,
        stockNuevo,
        usuarioId: req.user.id,
      });

      await client.query(
        `
        insert into ventas (fecha, cod_producto, canal, cantidad, precio_unitario, empresa_id)
        values (current_date, $1, 'punto_venta', $2, $3, $4)
        `,
        [item.cod_producto, item.cantidad, item.precio_unitario, empresa_id]
      );
    }

    const ventaResult = await client.query(
      `
      insert into punto_venta (
        empresa_id, usuario_id, subtotal, impuestos, descuento, total,
        metodo_pago, estado
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'finalizada')
      returning *
      `,
      [
        empresa_id,
        String(req.user.id),
        venta.subtotal,
        venta.impuestos,
        venta.descuento,
        venta.total,
        metodo_pago,
      ]
    );

    for (const item of venta.detalle) {
      await client.query(
        `
        insert into punto_venta_detalle (
          punto_venta_id, producto_id, cod_producto, descripcion,
          cantidad, precio_unitario, subtotal
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          ventaResult.rows[0].id,
          item.producto_id,
          item.cod_producto,
          item.descripcion,
          item.cantidad,
          item.precio_unitario,
          item.subtotal,
        ]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "POS_VENTA_CREADA",
      `Venta POS creada: ${ventaResult.rows[0].id}`,
      empresa_id
    );

    res.status(201).json({ venta: ventaResult.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(400).json({ error: error.message || "Error al registrar venta POS" });
  } finally {
    client.release();
  }
});

api.get("/pos/ventas-dia", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("pv", empresaIds, 1);
    const result = await db.query(
      `
      select pv.id, pv.empresa_id, e.nombre as empresa, pv.fecha, pv.subtotal,
        pv.impuestos, pv.descuento, pv.total, pv.metodo_pago, pv.estado
      from punto_venta pv
      join empresas e on e.id = pv.empresa_id
      where pv.fecha::date = current_date
      ${filtroEmpresa.clause}
      order by pv.fecha desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, ventas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener ventas POS del dia" });
  }
});

api.post("/pos/corte", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { empresa_id, monto_inicial = 0, cerrar = false } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!cerrar) {
      const abierto = await db.query(
        "select id from cortes_caja where empresa_id=$1 and usuario_id=$2 and estado='abierto'",
        [empresa_id, String(req.user.id)]
      );

      if (abierto.rows.length > 0) {
        return res.status(409).json({ error: "Ya existe un corte abierto" });
      }

      const result = await db.query(
        `
        insert into cortes_caja (empresa_id, usuario_id, monto_inicial, estado)
        values ($1, $2, $3, 'abierto')
        returning *
        `,
        [empresa_id, String(req.user.id), monto_inicial]
      );

      return res.status(201).json({ corte: result.rows[0] });
    }

    const resumen = await db.query(
      `
      select
        coalesce(sum(case when metodo_pago = 'efectivo' then total else 0 end), 0) as ventas_efectivo,
        coalesce(sum(case when metodo_pago = 'tarjeta' then total else 0 end), 0) as ventas_tarjeta,
        coalesce(sum(case when metodo_pago = 'transferencia' then total else 0 end), 0) as ventas_transferencia,
        coalesce(sum(total), 0) as total_ventas
      from punto_venta
      where empresa_id = $1 and usuario_id = $2 and fecha::date = current_date
      `,
      [empresa_id, String(req.user.id)]
    );

    const result = await db.query(
      `
      update cortes_caja
      set fecha_cierre = now(),
          ventas_efectivo = $1,
          ventas_tarjeta = $2,
          ventas_transferencia = $3,
          total_ventas = $4,
          estado = 'cerrado',
          updated_at = now()
      where empresa_id = $5 and usuario_id = $6 and estado = 'abierto'
      returning *
      `,
      [
        resumen.rows[0].ventas_efectivo,
        resumen.rows[0].ventas_tarjeta,
        resumen.rows[0].ventas_transferencia,
        resumen.rows[0].total_ventas,
        empresa_id,
        String(req.user.id),
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No hay corte abierto para cerrar" });
    }

    res.json({ corte: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar corte de caja" });
  }
});

api.get("/pos/cortes", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("c", empresaIds, 1);
    const result = await db.query(
      `
      select c.*, e.nombre as empresa
      from cortes_caja c
      join empresas e on e.id = c.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by c.created_at desc
      limit 50
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, cortes: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener cortes de caja" });
  }
});

api.get("/productos", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("p", empresaIds, 1);
    const result = await db.query(
      `
      select
        p.cod_producto,
        p.empresa_id,
        e.nombre as empresa,
        p.nombre,
        p.categoria,
        p.tipo,
        p.descripcion,
        p.stock_minimo,
        p.precio_venta,
        p.estado,
        coalesce(i.stock_fisico, 0) as stock_fisico,
        coalesce(i.stock_reportado, 0) as stock_reportado
      from productos p
      join empresas e on e.id = p.empresa_id
      left join inventario i on i.cod_producto = p.cod_producto
        and (i.empresa_id = p.empresa_id or i.empresa_id is null or p.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by p.nombre asc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, productos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

api.post("/productos", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      cod_producto,
      nombre,
      categoria,
      tipo = "producto",
      descripcion,
      stock_minimo = 10,
      precio_venta = 0,
      stock_inicial = 0,
      estado = "activo",
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!cod_producto || !nombre) {
      return res.status(400).json({ error: "Codigo y nombre son requeridos" });
    }

    await client.query("begin");
    const producto = await client.query(
      `
      insert into productos (
        empresa_id, cod_producto, nombre, categoria, tipo, descripcion,
        stock_minimo, precio_venta, estado
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        empresa_id,
        cod_producto,
        nombre,
        categoria || null,
        tipo,
        descripcion || null,
        stock_minimo,
        precio_venta,
        estado,
      ]
    );

    await client.query(
      `
      insert into inventario (empresa_id, cod_producto, stock_fisico, stock_reportado)
      values ($1, $2, $3, $3)
      on conflict do nothing
      `,
      [empresa_id, cod_producto, stock_inicial]
    );

    if (categoria) {
      await client.query(
        `
        insert into categorias_productos (empresa_id, nombre)
        values ($1, $2)
        on conflict (empresa_id, nombre) do nothing
        `,
        [empresa_id, categoria]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "PRODUCTO_CREADO",
      `Producto creado: ${cod_producto}`,
      empresa_id
    );

    res.status(201).json({ producto: producto.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({ error: "El codigo de producto ya existe" });
    }

    res.status(500).json({ error: "Error al crear producto" });
  } finally {
    client.release();
  }
});

api.put("/productos/:codigo", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { empresa_id } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    const {
      nombre,
      categoria,
      tipo,
      descripcion,
      stock_minimo,
      precio_venta,
      estado,
    } = req.body;

    const result = await db.query(
      `
      update productos
      set nombre = coalesce($1, nombre),
          categoria = $2,
          tipo = coalesce($3, tipo),
          descripcion = $4,
          stock_minimo = coalesce($5, stock_minimo),
          precio_venta = coalesce($6, precio_venta),
          estado = coalesce($7, estado),
          updated_at = now()
      where empresa_id = $8 and cod_producto = $9
      returning *
      `,
      [
        nombre,
        categoria || null,
        tipo,
        descripcion || null,
        stock_minimo,
        precio_venta,
        estado,
        empresa_id,
        req.params.codigo,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ producto: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

api.get(
  "/categorias-productos",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const empresaIds = await resolverEmpresasPermitidas(req, res);

      if (!empresaIds) {
        return;
      }

      const filtroEmpresa = empresaWhere("c", empresaIds, 1);
      const result = await db.query(
        `
        select c.id, c.empresa_id, e.nombre as empresa, c.nombre,
          c.descripcion, c.estado, c.created_at, c.updated_at
        from categorias_productos c
        join empresas e on e.id = c.empresa_id
        where true
        ${filtroEmpresa.clause}
        order by c.nombre asc
        `,
        [...filtroEmpresa.params]
      );

      res.json({ total: result.rows.length, categorias: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al obtener categorias" });
    }
  }
);

api.post(
  "/categorias-productos",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const { empresa_id, nombre, descripcion, estado = "activa" } = req.body;

      if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
        return;
      }

      if (!nombre) {
        return res.status(400).json({ error: "El nombre es requerido" });
      }

      const result = await db.query(
        `
        insert into categorias_productos (empresa_id, nombre, descripcion, estado)
        values ($1, $2, $3, $4)
        returning *
        `,
        [empresa_id, nombre, descripcion || null, estado]
      );

      res.status(201).json({ categoria: result.rows[0] });
    } catch (error) {
      console.error(error);

      if (error.code === "23505") {
        return res.status(409).json({ error: "La categoria ya existe" });
      }

      res.status(500).json({ error: "Error al crear categoria" });
    }
  }
);

api.put(
  "/categorias-productos/:id",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const actual = await db.query(
        "select empresa_id from categorias_productos where id=$1",
        [req.params.id]
      );

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Categoria no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
        return;
      }

      const { nombre, descripcion, estado } = req.body;
      const result = await db.query(
        `
        update categorias_productos
        set nombre = coalesce($1, nombre),
            descripcion = $2,
            estado = coalesce($3, estado),
            updated_at = now()
        where id = $4
        returning *
        `,
        [nombre, descripcion || null, estado, req.params.id]
      );

      res.json({ categoria: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al actualizar categoria" });
    }
  }
);

api.get(
  "/inventario/kardex/:producto_id",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const empresaIds = await resolverEmpresasPermitidas(req, res);

      if (!empresaIds) {
        return;
      }

      const filtroEmpresa = empresaWhere("m", empresaIds, 2);
      const result = await db.query(
        `
        select m.id, m.empresa_id, e.nombre as empresa, m.cod_producto,
          coalesce(p.nombre, m.cod_producto) as producto, m.tipo_movimiento,
          m.referencia, m.cantidad, m.stock_anterior, m.stock_nuevo,
          m.usuario_id, m.created_at
        from movimientos_inventario m
        join empresas e on e.id = m.empresa_id
        left join productos p on p.cod_producto = m.cod_producto
          and p.empresa_id = m.empresa_id
        where m.cod_producto = $1
        ${filtroEmpresa.clause}
        order by m.created_at desc
        limit 200
        `,
        [req.params.producto_id, ...filtroEmpresa.params]
      );

      res.json({ total: result.rows.length, movimientos: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al obtener Kardex" });
    }
  }
);

api.get("/inventario/movimientos", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { tipo = "todos" } = req.query;
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("m", empresaIds, 2);
    const result = await db.query(
      `
      select m.id, m.empresa_id, e.nombre as empresa, m.cod_producto,
        coalesce(p.nombre, m.cod_producto) as producto, m.tipo_movimiento,
        m.referencia, m.cantidad, m.stock_anterior, m.stock_nuevo,
        m.usuario_id, m.created_at
      from movimientos_inventario m
      join empresas e on e.id = m.empresa_id
      left join productos p on p.cod_producto = m.cod_producto
        and p.empresa_id = m.empresa_id
      where ($1 = 'todos' or m.tipo_movimiento = $1)
      ${filtroEmpresa.clause}
      order by m.created_at desc
      limit 300
      `,
      [tipo, ...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, movimientos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener movimientos de inventario" });
  }
});

api.post("/inventario/ajuste", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      cod_producto,
      tipo = "ajuste_manual",
      cantidad,
      referencia,
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    const cantidadAjuste = Number(cantidad || 0);

    if (!cod_producto || cantidadAjuste === 0) {
      return res.status(400).json({ error: "Producto y cantidad son requeridos" });
    }

    await client.query("begin");
    const inventario = await client.query(
      `
      select id, stock_fisico
      from inventario
      where empresa_id = $1 and cod_producto = $2
      for update
      `,
      [empresa_id, cod_producto]
    );
    const stockAnterior =
      inventario.rows.length > 0 ? Number(inventario.rows[0].stock_fisico) : 0;
    const stockNuevo = stockAnterior + cantidadAjuste;

    if (stockNuevo < 0) {
      await client.query("rollback");
      return res.status(409).json({ error: "El ajuste deja stock negativo" });
    }

    if (inventario.rows.length > 0) {
      await client.query(
        `
        update inventario
        set stock_fisico = $1, stock_reportado = $1
        where id = $2
        `,
        [stockNuevo, inventario.rows[0].id]
      );
    } else {
      await client.query(
        `
        insert into inventario (empresa_id, cod_producto, stock_fisico, stock_reportado)
        values ($1, $2, $3, $3)
        `,
        [empresa_id, cod_producto, stockNuevo]
      );
    }

    await registrarMovimientoInventario(client, {
      empresaId: empresa_id,
      codProducto: cod_producto,
      tipoMovimiento: tipo,
      referencia: referencia || "ajuste_manual",
      cantidad: cantidadAjuste,
      stockAnterior,
      stockNuevo,
      usuarioId: req.user.id,
    });

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "INVENTARIO_AJUSTADO",
      `Ajuste de inventario: ${cod_producto}`,
      empresa_id
    );

    res.json({
      ajuste: {
        empresa_id,
        cod_producto,
        cantidad: cantidadAjuste,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
      },
    });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al ajustar inventario" });
  } finally {
    client.release();
  }
});

api.get("/inventario/alertas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("i", empresaIds, 1);
    const result = await db.query(
      `
      select i.id, i.empresa_id, e.nombre as empresa, i.cod_producto,
        p.nombre, i.stock_fisico as stock_actual,
        coalesce(p.stock_minimo, 10) as stock_minimo,
        case
          when i.stock_fisico = 0 then 'CRITICA'
          when i.stock_fisico < coalesce(p.stock_minimo, 10) * 0.5 then 'ALTA'
          else 'MEDIA'
        end as severidad
      from inventario i
      join empresas e on e.id = i.empresa_id
      join productos p on p.cod_producto = i.cod_producto
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where i.stock_fisico < coalesce(p.stock_minimo, 10)
      ${filtroEmpresa.clause}
      order by i.stock_fisico asc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, alertas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener alertas de inventario" });
  }
});

api.get("/proveedores", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("p", empresaIds, 1);
    const result = await db.query(
      `
      select p.id, p.empresa_id, e.nombre as empresa, p.nombre, p.nit,
        p.telefono, p.email, p.direccion, p.estado, p.created_at, p.updated_at
      from proveedores p
      join empresas e on e.id = p.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by p.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, proveedores: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

api.post("/proveedores", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const {
      empresa_id,
      nombre,
      nit,
      telefono,
      email,
      direccion,
      estado = "activo",
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del proveedor es requerido" });
    }

    const result = await db.query(
      `
      insert into proveedores (empresa_id, nombre, nit, telefono, email, direccion, estado)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
      `,
      [empresa_id, nombre, nit, telefono, email, direccion, estado]
    );

    await registrarAuditoria(
      req.user.id,
      "PROVEEDOR_CREADO",
      `Proveedor creado: ${nombre}`,
      empresa_id
    );

    res.status(201).json({ proveedor: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear proveedor" });
  }
});

api.get("/compras", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("c", empresaIds, 1);
    const result = await db.query(
      `
      select c.id, c.empresa_id, e.nombre as empresa, c.proveedor_id,
        coalesce(p.nombre, 'Proveedor no registrado') as proveedor,
        c.numero, c.fecha, c.estado, c.subtotal, c.impuestos,
        c.total, c.created_at, c.updated_at
      from compras c
      join empresas e on e.id = c.empresa_id
      left join proveedores p on p.id = c.proveedor_id
      where true
      ${filtroEmpresa.clause}
      order by c.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, compras: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

api.post("/compras", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const {
      empresa_id,
      proveedor_id,
      numero,
      fecha,
      estado = "borrador",
      lineas = [],
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({ error: "La compra requiere productos" });
    }

    const calculo = calcularCompraLineas(lineas);
    const numeroDocumento =
      numero || (await generarNumeroDocumento("compras", "OC", empresa_id));

    await client.query("begin");
    const compra = await client.query(
      `
      insert into compras (
        empresa_id, proveedor_id, usuario_id, numero, fecha,
        estado, subtotal, impuestos, total
      )
      values ($1, $2, $3, $4, coalesce($5, current_date), $6, $7, $8, $9)
      returning *
      `,
      [
        empresa_id,
        proveedor_id || null,
        String(req.user.id),
        numeroDocumento,
        fecha || null,
        estado,
        calculo.subtotal,
        calculo.impuestos,
        calculo.total,
      ]
    );

    for (const linea of calculo.detalle) {
      await client.query(
        `
        insert into compra_detalle (
          compra_id, producto_id, cod_producto, descripcion,
          cantidad, costo_unitario, subtotal
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          compra.rows[0].id,
          linea.producto_id,
          linea.cod_producto,
          linea.descripcion,
          linea.cantidad,
          linea.costo_unitario,
          linea.subtotal,
        ]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "COMPRA_CREADA",
      `Compra creada: ${numeroDocumento}`,
      empresa_id
    );

    res.status(201).json({ compra: compra.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al crear compra" });
  } finally {
    client.release();
  }
});

api.get("/compras/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const compra = await db.query(
      `
      select c.*, coalesce(p.nombre, 'Proveedor no registrado') as proveedor
      from compras c
      left join proveedores p on p.id = c.proveedor_id
      where c.id = $1
      `,
      [req.params.id]
    );

    if (compra.rows.length === 0) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, compra.rows[0].empresa_id))) {
      return;
    }

    const detalle = await db.query(
      "select * from compra_detalle where compra_id=$1 order by id asc",
      [req.params.id]
    );

    res.json({ compra: { ...compra.rows[0], lineas: detalle.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener compra" });
  }
});

api.put("/compras/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const actual = await db.query("select * from compras where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
      return;
    }

    if (actual.rows[0].estado === "recibida") {
      return res.status(409).json({ error: "No se puede editar una compra recibida" });
    }

    const { proveedor_id, fecha, estado, lineas } = req.body;
    const calculo = Array.isArray(lineas) ? calcularCompraLineas(lineas) : null;

    await client.query("begin");
    const compra = await client.query(
      `
      update compras
      set proveedor_id = coalesce($1, proveedor_id),
          fecha = coalesce($2, fecha),
          estado = coalesce($3, estado),
          subtotal = coalesce($4, subtotal),
          impuestos = coalesce($5, impuestos),
          total = coalesce($6, total),
          updated_at = now()
      where id = $7
      returning *
      `,
      [
        proveedor_id || null,
        fecha || null,
        estado || null,
        calculo?.subtotal ?? null,
        calculo?.impuestos ?? null,
        calculo?.total ?? null,
        req.params.id,
      ]
    );

    if (calculo) {
      await client.query("delete from compra_detalle where compra_id=$1", [
        req.params.id,
      ]);

      for (const linea of calculo.detalle) {
        await client.query(
          `
          insert into compra_detalle (
            compra_id, producto_id, cod_producto, descripcion,
            cantidad, costo_unitario, subtotal
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            req.params.id,
            linea.producto_id,
            linea.cod_producto,
            linea.descripcion,
            linea.cantidad,
            linea.costo_unitario,
            linea.subtotal,
          ]
        );
      }
    }

    await client.query("commit");
    res.json({ compra: compra.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al actualizar compra" });
  } finally {
    client.release();
  }
});

api.post(
  "/compras/:id/recibir",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    const client = await db.connect();

    try {
      const compra = await db.query("select * from compras where id=$1", [
        req.params.id,
      ]);

      if (compra.rows.length === 0) {
        return res.status(404).json({ error: "Compra no encontrada" });
      }

      const compraActual = compra.rows[0];

      if (!(await validarEmpresaPermitida(req, res, compraActual.empresa_id))) {
        return;
      }

      if (compraActual.estado === "recibida") {
        return res.status(409).json({ error: "La compra ya fue recibida" });
      }

      if (compraActual.estado === "cancelada") {
        return res.status(409).json({ error: "No se puede recibir una compra cancelada" });
      }

      const detalle = await db.query(
        "select * from compra_detalle where compra_id=$1",
        [req.params.id]
      );

      await client.query("begin");

      for (const linea of detalle.rows) {
        const inventarioActual = await client.query(
          `
          select id, stock_fisico
          from inventario
          where empresa_id = $1 and cod_producto = $2
          for update
          `,
          [compraActual.empresa_id, linea.cod_producto]
        );
        const stockAnterior =
          inventarioActual.rows.length > 0
            ? Number(inventarioActual.rows[0].stock_fisico)
            : 0;
        const stockNuevo = stockAnterior + Number(linea.cantidad);

        const actualizado = await client.query(
          `
          update inventario
          set stock_fisico = stock_fisico + $1,
              stock_reportado = stock_reportado + $1
          where empresa_id = $2 and cod_producto = $3
          returning id
          `,
          [linea.cantidad, compraActual.empresa_id, linea.cod_producto]
        );

        if (actualizado.rows.length === 0) {
          await client.query(
            `
            insert into inventario (
              empresa_id, cod_producto, stock_fisico, stock_reportado
            )
            values ($1, $2, $3, $3)
            `,
            [compraActual.empresa_id, linea.cod_producto, linea.cantidad]
          );
        }

        await registrarMovimientoInventario(client, {
          empresaId: compraActual.empresa_id,
          codProducto: linea.cod_producto,
          tipoMovimiento: "entrada_compra",
          referencia: compraActual.numero,
          cantidad: Number(linea.cantidad),
          stockAnterior,
          stockNuevo,
          usuarioId: req.user.id,
        });
      }

      const result = await client.query(
        "update compras set estado='recibida', updated_at=now() where id=$1 returning *",
        [req.params.id]
      );

      await client.query("commit");
      await registrarAuditoria(
        req.user.id,
        "COMPRA_RECIBIDA",
        `Compra recibida: ${compraActual.numero}`,
        compraActual.empresa_id
      );

      res.json({ compra: result.rows[0] });
    } catch (error) {
      await client.query("rollback");
      console.error(error);
      res.status(500).json({ error: "Error al recibir compra" });
    } finally {
      client.release();
    }
  }
);

api.get("/facturas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("f", empresaIds, 1);
    const result = await db.query(
      `
      select f.id, f.empresa_id, e.nombre as empresa, f.cliente_id,
        coalesce(c.nombre, 'Cliente no registrado') as cliente,
        f.numero, f.fecha, f.estado, f.subtotal, f.impuestos,
        f.total, f.notas, f.created_at, f.updated_at
      from facturas f
      join empresas e on e.id = f.empresa_id
      left join clientes c on c.id = f.cliente_id
      where true
      ${filtroEmpresa.clause}
      order by f.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, facturas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener facturas" });
  }
});

api.post("/facturas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const { empresa_id, cliente_id, fecha, notas, lineas = [] } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) {
      return;
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({ error: "La factura requiere productos" });
    }

    const calculo = calcularLineas(lineas);
    const numero = await generarNumeroDocumento("facturas", "FAC", empresa_id);

    await client.query("begin");
    const factura = await client.query(
      `
      insert into facturas (
        empresa_id, cliente_id, usuario_id, numero, fecha,
        estado, subtotal, impuestos, total, notas
      )
      values ($1, $2, $3, $4, coalesce($5, current_date), 'borrador', $6, $7, $8, $9)
      returning *
      `,
      [
        empresa_id,
        cliente_id || null,
        String(req.user.id),
        numero,
        fecha || null,
        calculo.subtotal,
        calculo.impuestos,
        calculo.total,
        notas || null,
      ]
    );

    for (const linea of calculo.detalle) {
      await client.query(
        `
        insert into factura_detalle (
          factura_id, producto_id, cod_producto, descripcion, cantidad,
          precio_unitario, impuesto_porcentaje, subtotal
        )
        values ($1, $2, $2, $3, $4, $5, $6, $7)
        `,
        [
          factura.rows[0].id,
          linea.producto_id,
          linea.descripcion,
          linea.cantidad,
          linea.precio_unitario,
          linea.impuesto_porcentaje,
          linea.subtotal,
        ]
      );
    }

    await client.query("commit");
    await registrarAuditoria(
      req.user.id,
      "FACTURA_CREADA",
      `Factura creada: ${numero}`,
      empresa_id
    );

    res.status(201).json({ factura: factura.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al crear factura" });
  } finally {
    client.release();
  }
});

api.get("/facturas/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const factura = await db.query(
      `
      select f.*, e.nombre as empresa, e.nit as empresa_nit,
        e.direccion as empresa_direccion, e.telefono as empresa_telefono,
        e.email as empresa_email, coalesce(c.nombre, 'Cliente no registrado') as cliente,
        c.nit as cliente_nit, c.direccion as cliente_direccion,
        c.email as cliente_email, c.telefono as cliente_telefono
      from facturas f
      join empresas e on e.id = f.empresa_id
      left join clientes c on c.id = f.cliente_id
      where f.id = $1
      `,
      [req.params.id]
    );

    if (factura.rows.length === 0) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, factura.rows[0].empresa_id))) {
      return;
    }

    const detalle = await db.query(
      "select * from factura_detalle where factura_id=$1 order by id asc",
      [req.params.id]
    );

    res.json({ factura: { ...factura.rows[0], lineas: detalle.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener factura" });
  }
});

api.put("/facturas/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  const client = await db.connect();

  try {
    const actual = await db.query("select * from facturas where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
      return;
    }

    if (actual.rows[0].estado !== "borrador") {
      return res.status(409).json({ error: "Solo se puede editar en borrador" });
    }

    const { empresa_id, cliente_id, fecha, notas, lineas } = req.body;
    const empresaDestino = empresa_id || actual.rows[0].empresa_id;

    if (!(await validarEmpresaPermitida(req, res, empresaDestino))) {
      return;
    }

    const calculo = Array.isArray(lineas) ? calcularLineas(lineas) : null;

    await client.query("begin");
    const factura = await client.query(
      `
      update facturas
      set empresa_id = coalesce($1, empresa_id),
          cliente_id = $2,
          fecha = coalesce($3, fecha),
          notas = $4,
          subtotal = coalesce($5, subtotal),
          impuestos = coalesce($6, impuestos),
          total = coalesce($7, total),
          updated_at = now()
      where id = $8
      returning *
      `,
      [
        empresa_id || null,
        cliente_id || null,
        fecha || null,
        notas || null,
        calculo?.subtotal ?? null,
        calculo?.impuestos ?? null,
        calculo?.total ?? null,
        req.params.id,
      ]
    );

    if (calculo) {
      await client.query("delete from factura_detalle where factura_id=$1", [
        req.params.id,
      ]);

      for (const linea of calculo.detalle) {
        await client.query(
          `
          insert into factura_detalle (
            factura_id, producto_id, cod_producto, descripcion, cantidad,
            precio_unitario, impuesto_porcentaje, subtotal
          )
          values ($1, $2, $2, $3, $4, $5, $6, $7)
          `,
          [
            req.params.id,
            linea.producto_id,
            linea.descripcion,
            linea.cantidad,
            linea.precio_unitario,
            linea.impuesto_porcentaje,
            linea.subtotal,
          ]
        );
      }
    }

    await client.query("commit");
    res.json({ factura: factura.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Error al actualizar factura" });
  } finally {
    client.release();
  }
});

api.post(
  "/facturas/:id/confirmar",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const actual = await db.query("select * from facturas where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
        return;
      }

      if (actual.rows[0].estado !== "borrador") {
        return res.status(409).json({ error: "La factura no esta en borrador" });
      }

      const result = await db.query(
        "update facturas set estado='pendiente', updated_at=now() where id=$1 returning *",
        [req.params.id]
      );

      res.json({ factura: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al confirmar factura" });
    }
  }
);

api.post(
  "/facturas/:id/validar",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const actual = await db.query("select * from facturas where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
        return;
      }

      if (actual.rows[0].estado !== "pendiente") {
        return res.status(409).json({ error: "La factura debe estar pendiente" });
      }

      const result = await db.query(
        "update facturas set estado='publicado', updated_at=now() where id=$1 returning *",
        [req.params.id]
      );

      await registrarAuditoria(
        req.user.id,
        "FACTURA_PUBLICADA",
        `Factura publicada: ${result.rows[0].numero}`,
        result.rows[0].empresa_id
      );

      res.json({ factura: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al validar factura" });
    }
  }
);

api.post(
  "/facturas/:id/restablecer-borrador",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const actual = await db.query("select * from facturas where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) {
        return;
      }

      const result = await db.query(
        "update facturas set estado='borrador', updated_at=now() where id=$1 returning *",
        [req.params.id]
      );

      await registrarAuditoria(
        req.user.id,
        "FACTURA_RESTABLECIDA",
        `Factura restablecida a borrador: ${result.rows[0].numero}`,
        result.rows[0].empresa_id
      );

      res.json({ factura: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al restablecer factura" });
    }
  }
);

api.get(
  "/facturas/:id/imprimir",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const factura = await db.query(
        `
        select f.*, e.nombre as empresa, e.nit as empresa_nit,
          e.direccion as empresa_direccion, e.telefono as empresa_telefono,
          e.email as empresa_email, coalesce(c.nombre, 'Consumidor final') as cliente,
          c.nit as cliente_nit, c.direccion as cliente_direccion,
          c.email as cliente_email, c.telefono as cliente_telefono
        from facturas f
        join empresas e on e.id = f.empresa_id
        left join clientes c on c.id = f.cliente_id
        where f.id = $1
        `,
        [req.params.id]
      );

      if (factura.rows.length === 0) {
        return res.status(404).send("Factura no encontrada");
      }

      const data = factura.rows[0];

      if (!(await validarEmpresaPermitida(req, res, data.empresa_id))) {
        return;
      }

      const detalle = await db.query(
        "select * from factura_detalle where factura_id=$1 order by id asc",
        [req.params.id]
      );
      const rows = detalle.rows
        .map(
          (linea) => `
            <tr>
              <td>${escapeHtml(linea.descripcion || linea.cod_producto)}</td>
              <td class="num">${Number(linea.cantidad).toFixed(2)}</td>
              <td class="num">Q ${Number(linea.precio_unitario).toFixed(2)}</td>
              <td class="num">Q ${Number(linea.subtotal).toFixed(2)}</td>
            </tr>`
        )
        .join("");

      const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Factura ${escapeHtml(data.numero)}</title>
        <style>
          @page { size: letter; margin: 18mm; }
          body { font-family: Arial, sans-serif; color: #172033; }
          .invoice { max-width: 820px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 18px; }
          .brand { font-size: 28px; font-weight: 800; color: #2563eb; }
          .muted { color: #64748b; font-size: 13px; }
          .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-top: 18px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th { background: #eff6ff; text-align: left; }
          th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          .num { text-align: right; }
          .totals { width: 320px; margin-left: auto; margin-top: 18px; }
          .totals div { display: flex; justify-content: space-between; padding: 8px 0; }
          .total { font-size: 20px; font-weight: 800; border-top: 2px solid #172033; }
          .status { text-transform: uppercase; font-weight: 800; color: #166534; }
          .actions { margin: 20px 0; text-align: right; }
          .actions button { padding: 10px 14px; border: 0; border-radius: 8px; background: #2563eb; color: white; font-weight: 700; }
          @media print { .actions { display: none; } }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
          <section class="header">
            <div>
              <div class="brand">${escapeHtml(data.empresa)}</div>
              <div class="muted">NIT: ${escapeHtml(data.empresa_nit || "CF")}</div>
              <div class="muted">${escapeHtml(data.empresa_direccion || "")}</div>
              <div class="muted">${escapeHtml(data.empresa_telefono || "")} ${escapeHtml(data.empresa_email || "")}</div>
            </div>
            <div>
              <h1>Factura</h1>
              <div><strong>No.</strong> ${escapeHtml(data.numero)}</div>
              <div><strong>Fecha:</strong> ${escapeHtml(data.fecha)}</div>
              <div class="status">${escapeHtml(data.estado)}</div>
            </div>
          </section>
          <section class="grid">
            <div class="box">
              <strong>Cliente</strong>
              <div>${escapeHtml(data.cliente)}</div>
              <div class="muted">NIT: ${escapeHtml(data.cliente_nit || "CF")}</div>
              <div class="muted">${escapeHtml(data.cliente_direccion || "")}</div>
            </div>
            <div class="box">
              <strong>Notas</strong>
              <div class="muted">${escapeHtml(data.notas || "Gracias por su compra.")}</div>
            </div>
          </section>
          <table>
            <thead>
              <tr><th>Descripcion</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <section class="totals">
            <div><span>Subtotal</span><strong>Q ${Number(data.subtotal).toFixed(2)}</strong></div>
            <div><span>IVA</span><strong>Q ${Number(data.impuestos).toFixed(2)}</strong></div>
            <div class="total"><span>Total</span><strong>Q ${Number(data.total).toFixed(2)}</strong></div>
          </section>
        </div>
      </body>
      </html>`;

      await registrarAuditoria(
        req.user.id,
        "FACTURA_IMPRESA",
        `Factura impresa: ${data.numero}`,
        data.empresa_id
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error al imprimir factura");
    }
  }
);

api.get("/empleados", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("em", empresaIds, 1);
    const result = await db.query(
      `
      select em.*, e.nombre as empresa
      from empleados em
      join empresas e on e.id = em.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by em.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, empleados: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener empleados" });
  }
});

api.post("/empleados", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const {
      empresa_id,
      usuario_id,
      codigo,
      nombre,
      dpi,
      telefono,
      email,
      direccion,
      puesto,
      departamento,
      fecha_ingreso,
      salario_base = 0,
      estado = "activo",
    } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) return;
    if (!codigo || !nombre) {
      return res.status(400).json({ error: "Codigo y nombre son requeridos" });
    }

    const result = await db.query(
      `
      insert into empleados (
        empresa_id, usuario_id, codigo, nombre, dpi, telefono, email,
        direccion, puesto, departamento, fecha_ingreso, salario_base, estado
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      returning *
      `,
      [
        empresa_id,
        usuario_id || null,
        codigo,
        nombre,
        dpi || null,
        telefono || null,
        email || null,
        direccion || null,
        puesto || null,
        departamento || null,
        fecha_ingreso || null,
        salario_base,
        estado,
      ]
    );

    res.status(201).json({ empleado: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear empleado" });
  }
});

api.get("/empleados/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const result = await db.query("select * from empleados where id=$1", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    if (!(await validarEmpresaPermitida(req, res, result.rows[0].empresa_id))) return;

    res.json({ empleado: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener empleado" });
  }
});

api.put("/empleados/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const actual = await db.query("select empresa_id from empleados where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) return;

    const {
      nombre,
      dpi,
      telefono,
      email,
      direccion,
      puesto,
      departamento,
      fecha_ingreso,
      salario_base,
      estado,
    } = req.body;
    const result = await db.query(
      `
      update empleados
      set nombre = coalesce($1, nombre), dpi = $2, telefono = $3,
        email = $4, direccion = $5, puesto = $6, departamento = $7,
        fecha_ingreso = $8, salario_base = coalesce($9, salario_base),
        estado = coalesce($10, estado), updated_at = now()
      where id = $11
      returning *
      `,
      [
        nombre,
        dpi || null,
        telefono || null,
        email || null,
        direccion || null,
        puesto || null,
        departamento || null,
        fecha_ingreso || null,
        salario_base,
        estado,
        req.params.id,
      ]
    );

    res.json({ empleado: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar empleado" });
  }
});

api.delete("/empleados/:id", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const actual = await db.query("select empresa_id from empleados where id=$1", [
      req.params.id,
    ]);

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) return;

    const result = await db.query(
      "update empleados set estado='inactivo', updated_at=now() where id=$1 returning *",
      [req.params.id]
    );

    res.json({ empleado: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al desactivar empleado" });
  }
});

api.get("/vacaciones", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("v", empresaIds, 1);
    const result = await db.query(
      `
      select v.*, em.nombre as empleado, e.nombre as empresa
      from vacaciones v
      join empleados em on em.id = v.empleado_id
      join empresas e on e.id = v.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by v.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, vacaciones: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener vacaciones" });
  }
});

api.post("/vacaciones", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { empresa_id, empleado_id, fecha_inicio, fecha_fin, motivo } = req.body;

    if (!(await validarEmpresaPermitida(req, res, empresa_id))) return;
    if (!empleado_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: "Empleado y fechas son requeridos" });
    }

    const dias = diasEntreFechas(fecha_inicio, fecha_fin);
    const result = await db.query(
      `
      insert into vacaciones (
        empresa_id, empleado_id, fecha_inicio, fecha_fin,
        dias_solicitados, motivo, estado
      )
      values ($1,$2,$3,$4,$5,$6,'pendiente')
      returning *
      `,
      [empresa_id, empleado_id, fecha_inicio, fecha_fin, dias, motivo || null]
    );

    res.status(201).json({ vacaciones: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al solicitar vacaciones" });
  }
});

api.put(
  "/vacaciones/:id/aprobar",
  authMiddleware(["admin", "gerente"]),
  async (req, res) => {
    try {
      const actual = await db.query("select empresa_id from vacaciones where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) return;

      const result = await db.query(
        `
        update vacaciones
        set estado='aprobada', aprobado_por=$1,
          comentario_aprobacion=$2, updated_at=now()
        where id=$3
        returning *
        `,
        [String(req.user.id), req.body.comentario || null, req.params.id]
      );

      res.json({ vacaciones: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al aprobar vacaciones" });
    }
  }
);

api.put(
  "/vacaciones/:id/rechazar",
  authMiddleware(["admin", "gerente"]),
  async (req, res) => {
    try {
      const actual = await db.query("select empresa_id from vacaciones where id=$1", [
        req.params.id,
      ]);

      if (actual.rows.length === 0) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }

      if (!(await validarEmpresaPermitida(req, res, actual.rows[0].empresa_id))) return;

      const result = await db.query(
        `
        update vacaciones
        set estado='rechazada', aprobado_por=$1,
          comentario_aprobacion=$2, updated_at=now()
        where id=$3
        returning *
        `,
        [String(req.user.id), req.body.comentario || null, req.params.id]
      );

      res.json({ vacaciones: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al rechazar vacaciones" });
    }
  }
);

api.get(
  "/empleados/:id/vacaciones",
  authMiddleware(MANAGEMENT_ROLES),
  async (req, res) => {
    try {
      const empleado = await db.query("select empresa_id from empleados where id=$1", [
        req.params.id,
      ]);

      if (empleado.rows.length === 0) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }

      if (!(await validarEmpresaPermitida(req, res, empleado.rows[0].empresa_id))) return;

      const result = await db.query(
        "select * from vacaciones where empleado_id=$1 order by created_at desc",
        [req.params.id]
      );

      res.json({ total: result.rows.length, vacaciones: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al obtener vacaciones del empleado" });
    }
  }
);

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

    const mesInicio = `${fechaFin.slice(0, 7)}-01`;
    const ventasMesEmpresa = empresaWhere("v", empresaIds, 3);
    const ventasMes = await db.query(
      `
      select coalesce(sum(v.cantidad * v.precio_unitario), 0) as total
      from ventas v
      where v.fecha between $1 and $2
      ${ventasMesEmpresa.clause}
      `,
      [mesInicio, fechaFin, ...ventasMesEmpresa.params]
    );

    const comprasEmpresa = empresaWhere("c", empresaIds, 3);
    const comprasMes = await db.query(
      `
      select coalesce(sum(c.total), 0) as total
      from compras c
      where c.fecha between $1 and $2
      ${comprasEmpresa.clause}
      `,
      [mesInicio, fechaFin, ...comprasEmpresa.params]
    );

    const cotizacionesEmpresa = empresaWhere("c", empresaIds, 1);
    const cotizacionesPendientes = await db.query(
      `
      select count(*) as total
      from cotizaciones c
      where c.estado in ('cotizacion', 'cotizacion_enviada')
      ${cotizacionesEmpresa.clause}
      `,
      [...cotizacionesEmpresa.params]
    );

    const ordenesEmpresa = empresaWhere("o", empresaIds, 1);
    const ordenesPendientes = await db.query(
      `
      select count(*) as total
      from ordenes_venta o
      where o.estado not in ('cancelado')
      ${ordenesEmpresa.clause}
      `,
      [...ordenesEmpresa.params]
    );

    const empleadosEmpresa = empresaWhere("em", empresaIds, 1);
    const empleadosActivos = await db.query(
      `
      select count(*) as total
      from empleados em
      where em.estado = 'activo'
      ${empleadosEmpresa.clause}
      `,
      [...empleadosEmpresa.params]
    );

    const vacacionesEmpresa = empresaWhere("va", empresaIds, 1);
    const vacacionesPendientes = await db.query(
      `
      select count(*) as total
      from vacaciones va
      where va.estado = 'pendiente'
      ${vacacionesEmpresa.clause}
      `,
      [...vacacionesEmpresa.params]
    );

    const movimientosEmpresa = empresaWhere("m", empresaIds, 1);
    const ultimosMovimientos = await db.query(
      `
      select m.cod_producto, coalesce(p.nombre, m.cod_producto) as producto,
        m.tipo_movimiento, m.cantidad, m.stock_nuevo, m.created_at
      from movimientos_inventario m
      left join productos p on p.cod_producto = m.cod_producto
        and p.empresa_id = m.empresa_id
      where true
      ${movimientosEmpresa.clause}
      order by m.created_at desc
      limit 8
      `,
      [...movimientosEmpresa.params]
    );

    res.json({
      ventas_totales: Number(ventas.rows[0].ventas_totales),
      ventas_mes: Number(ventasMes.rows[0].total),
      comparativa_canales: canales.rows,
      top_productos: topProductos.rows,
      alertas_count: Number(alertas.rows[0].total),
      compras_mes: Number(comprasMes.rows[0].total),
      ordenes_pendientes: Number(ordenesPendientes.rows[0].total),
      cotizaciones_pendientes: Number(cotizacionesPendientes.rows[0].total),
      empleados_activos: Number(empleadosActivos.rows[0].total),
      vacaciones_pendientes: Number(vacacionesPendientes.rows[0].total),
      productos_stock_critico: Number(alertas.rows[0].total),
      ultimos_movimientos: ultimosMovimientos.rows,
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

api.get("/auditoria", authMiddleware(["admin", "gerente"]), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) {
      return;
    }

    const filtroEmpresa = empresaWhere("a", empresaIds, 1);
    const result = await db.query(
      `
      select a.id, a.usuario_id, a.empresa_id, e.nombre as empresa,
        a.accion, a.modulo, a.detalle, a.ip, a.created_at
      from auditoria a
      left join empresas e on e.id = a.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by a.created_at desc
      limit 200
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, eventos: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener auditoria" });
  }
});

api.get("/reportes/ventas", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { fecha_i = "2026-01-01", fecha_f = "2026-12-31" } = req.query;
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("v", empresaIds, 3);
    const result = await db.query(
      `
      select v.fecha, e.nombre as empresa, v.canal, v.cod_producto,
        coalesce(p.nombre, 'Producto no registrado') as producto,
        v.cantidad, v.precio_unitario,
        (v.cantidad * v.precio_unitario) as total
      from ventas v
      left join empresas e on e.id = v.empresa_id
      left join productos p on p.cod_producto = v.cod_producto
        and (p.empresa_id = v.empresa_id or p.empresa_id is null or v.empresa_id is null)
      where v.fecha between $1 and $2
      ${filtroEmpresa.clause}
      order by v.fecha desc
      `,
      [fecha_i, fecha_f, ...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, ventas: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de ventas" });
  }
});

api.get("/reportes/inventario", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("i", empresaIds, 1);
    const result = await db.query(
      `
      select e.nombre as empresa, i.cod_producto, p.nombre, p.categoria,
        i.stock_fisico, i.stock_reportado, p.stock_minimo
      from inventario i
      join empresas e on e.id = i.empresa_id
      join productos p on p.cod_producto = i.cod_producto
        and (p.empresa_id = i.empresa_id or p.empresa_id is null or i.empresa_id is null)
      where true
      ${filtroEmpresa.clause}
      order by p.nombre asc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, inventario: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de inventario" });
  }
});

api.get("/reportes/compras", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("c", empresaIds, 1);
    const result = await db.query(
      `
      select c.fecha, e.nombre as empresa, c.numero, c.estado,
        coalesce(p.nombre, 'Proveedor no registrado') as proveedor,
        c.subtotal, c.impuestos, c.total
      from compras c
      join empresas e on e.id = c.empresa_id
      left join proveedores p on p.id = c.proveedor_id
      where true
      ${filtroEmpresa.clause}
      order by c.fecha desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, compras: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de compras" });
  }
});

api.get("/reportes/empleados", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("em", empresaIds, 1);
    const result = await db.query(
      `
      select e.nombre as empresa, em.codigo, em.nombre, em.puesto,
        em.departamento, em.fecha_ingreso, em.salario_base, em.estado
      from empleados em
      join empresas e on e.id = em.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by em.nombre asc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, empleados: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de empleados" });
  }
});

api.get("/reportes/vacaciones", authMiddleware(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const empresaIds = await resolverEmpresasPermitidas(req, res);

    if (!empresaIds) return;

    const filtroEmpresa = empresaWhere("v", empresaIds, 1);
    const result = await db.query(
      `
      select e.nombre as empresa, em.nombre as empleado, v.fecha_inicio,
        v.fecha_fin, v.dias_solicitados, v.estado, v.motivo
      from vacaciones v
      join empleados em on em.id = v.empleado_id
      join empresas e on e.id = v.empresa_id
      where true
      ${filtroEmpresa.clause}
      order by v.created_at desc
      `,
      [...filtroEmpresa.params]
    );

    res.json({ total: result.rows.length, vacaciones: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar reporte de vacaciones" });
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
