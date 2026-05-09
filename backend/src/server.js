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

async function generarNumeroDocumento(tabla, prefijo, empresaId) {
  const result = await db.query(
    `select count(*)::int as total from ${tabla} where empresa_id = $1`,
    [empresaId]
  );
  const siguiente = Number(result.rows[0].total) + 1;

  return `${prefijo}-${String(siguiente).padStart(5, "0")}`;
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

      if (stockActual < item.cantidad) {
        throw new Error(`Stock insuficiente para ${item.cod_producto}`);
      }

      await client.query(
        "update inventario set stock_fisico = stock_fisico - $1 where id = $2",
        [item.cantidad, inventario.rows[0].id]
      );

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
