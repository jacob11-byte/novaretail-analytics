import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const ROLES = ["admin", "gerente", "supervisor", "vendedor", "bodega", "rrhh"];

const emptyEmpresa = {
  nombre: "",
  nit: "",
  direccion: "",
  telefono: "",
  email: "",
  estado: "activa",
};

const emptyUsuario = {
  nombre: "",
  email: "",
  password: "",
  rol: "vendedor",
  activo: true,
  empresas: [],
};

function App() {
  const [email, setEmail] = useState("admin@novaretail.com");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [usuario, setUsuario] = useState(() => {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  });
  const [dashboard, setDashboard] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [empresaScope, setEmpresaScope] = useState("all");
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState([]);
  const [vistaActual, setVistaActual] = useState("dashboard");
  const [tabAjustes, setTabAjustes] = useState("empresas");
  const [empresaForm, setEmpresaForm] = useState(emptyEmpresa);
  const [usuarioForm, setUsuarioForm] = useState(emptyUsuario);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const empresaQuery = useMemo(() => {
    if (empresaScope === "all") {
      return "all";
    }

    return empresasSeleccionadas.join(",");
  }, [empresaScope, empresasSeleccionadas]);

  const puedeAdministrar = usuario?.rol === "admin";

  const cargarDatos = useCallback(
    async (queryEmpresa = empresaQuery) => {
      if (!token) {
        return;
      }

      const params = { empresa_id: queryEmpresa };
      const [dashboardRes, alertasRes, ventasRes, inventarioRes] =
        await Promise.all([
          axios.get(`${API_URL}/dashboard`, { headers: authHeaders, params }),
          axios.get(`${API_URL}/alertas`, { headers: authHeaders, params }),
          axios.get(`${API_URL}/ventas`, { headers: authHeaders, params }),
          axios.get(`${API_URL}/inventario`, { headers: authHeaders, params }),
        ]);

      setDashboard(dashboardRes.data);
      setAlertas(alertasRes.data.alertas);
      setVentas(ventasRes.data.ventas);
      setInventario(inventarioRes.data.inventario);
    },
    [authHeaders, empresaQuery, token]
  );

  const cargarAjustes = useCallback(async () => {
    if (!token) {
      return;
    }

    const empresasRes = await axios.get(`${API_URL}/empresas`, {
      headers: authHeaders,
    });

    setEmpresas(empresasRes.data.empresas);
    setEmpresasSeleccionadas((current) =>
      current.length > 0 || empresasRes.data.empresas.length === 0
        ? current
        : [empresasRes.data.empresas[0].id]
    );

    if (puedeAdministrar) {
      const usuariosRes = await axios.get(`${API_URL}/usuarios`, {
        headers: authHeaders,
      });
      setUsuarios(usuariosRes.data.usuarios);
    }
  }, [authHeaders, puedeAdministrar, token]);

  const cargarSesion = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const meRes = await axios.get(`${API_URL}/auth/me`, {
        headers: authHeaders,
      });
      localStorage.setItem("usuario", JSON.stringify(meRes.data.user));
      setUsuario(meRes.data.user);
      await cargarAjustes();
      await cargarDatos();
      setError("");
    } catch {
      setError("No se pudo cargar la sesion. Inicia sesion nuevamente.");
    }
  }, [authHeaders, cargarAjustes, cargarDatos, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarSesion();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [cargarSesion]);

  async function login(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("usuario", JSON.stringify(response.data.user));
      setToken(response.data.token);
      setUsuario(response.data.user);
      setPassword("");
    } catch {
      setError("Credenciales invalidas o error de conexion.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
    setDashboard(null);
    setAlertas([]);
    setVentas([]);
    setInventario([]);
    setEmpresas([]);
    setUsuarios([]);
    setVistaActual("dashboard");
  }

  async function cambiarEmpresaScope(nextScope) {
    setEmpresaScope(nextScope);
    const nextQuery = nextScope === "all" ? "all" : empresasSeleccionadas.join(",");
    await cargarDatos(nextQuery);
  }

  async function toggleEmpresaSeleccionada(empresaId) {
    const nextSelection = empresasSeleccionadas.includes(empresaId)
      ? empresasSeleccionadas.filter((id) => id !== empresaId)
      : [...empresasSeleccionadas, empresaId];

    const selection = nextSelection.length > 0 ? nextSelection : [empresaId];
    setEmpresasSeleccionadas(selection);
    setEmpresaScope("custom");
    await cargarDatos(selection.join(","));
  }

  async function crearEmpresa(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(`${API_URL}/empresas`, empresaForm, {
        headers: authHeaders,
      });
      setEmpresaForm(emptyEmpresa);
      await cargarAjustes();
      setMensaje("Empresa creada correctamente.");
    } catch {
      setError("No se pudo crear la empresa.");
    }
  }

  async function cambiarEstadoEmpresa(empresa) {
    setError("");
    setMensaje("");

    try {
      await axios.put(
        `${API_URL}/empresas/${empresa.id}`,
        {
          ...empresa,
          estado: empresa.estado === "activa" ? "inactiva" : "activa",
        },
        { headers: authHeaders }
      );
      await cargarAjustes();
      setMensaje("Empresa actualizada correctamente.");
    } catch {
      setError("No se pudo actualizar la empresa.");
    }
  }

  async function crearUsuario(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(`${API_URL}/usuarios`, usuarioForm, {
        headers: authHeaders,
      });
      setUsuarioForm(emptyUsuario);
      await cargarAjustes();
      setMensaje("Usuario creado correctamente.");
    } catch {
      setError("No se pudo crear el usuario.");
    }
  }

  async function cambiarEstadoUsuario(user) {
    setError("");
    setMensaje("");

    try {
      await axios.put(
        `${API_URL}/usuarios/${user.id}`,
        { activo: !user.activo },
        { headers: authHeaders }
      );
      await cargarAjustes();
      setMensaje("Usuario actualizado correctamente.");
    } catch {
      setError("No se pudo actualizar el usuario.");
    }
  }

  async function descargarReporte(tipo) {
    try {
      const endpoint =
        tipo === "ventas"
          ? `${API_URL}/reportes/ventas-xlsx`
          : `${API_URL}/reportes/inventario-xlsx`;
      const nombreArchivo =
        tipo === "ventas" ? "reporte_ventas.xlsx" : "reporte_inventario.xlsx";

      const response = await axios.get(endpoint, {
        headers: authHeaders,
        params: { empresa_id: empresaQuery },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el reporte.");
    }
  }

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <span className="brand-icon">NR</span>
            <div>
              <h1>NovaRetail Analytics</h1>
              <p>Panel empresarial para ventas e inventario</p>
            </div>
          </div>

          <form onSubmit={login}>
            <label>Correo electronico</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@novaretail.com"
            />

            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contrasena"
            />

            {error && <p className="error">{error}</p>}

            <button type="submit">Iniciar sesion</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <span className="brand-icon">NR</span>
          <div>
            <h2>NovaRetail</h2>
            <p>Analytics</p>
          </div>
        </div>

        <nav>
          {["dashboard", "ventas", "inventario", "reportes", "auditoria"].map(
            (vista) => (
              <button
                key={vista}
                className={`menu-link ${vistaActual === vista ? "active" : ""}`}
                onClick={() => setVistaActual(vista)}
              >
                {vista === "dashboard"
                  ? "Dashboard"
                  : vista.charAt(0).toUpperCase() + vista.slice(1)}
              </button>
            )
          )}

          {puedeAdministrar && (
            <button
              className={`menu-link ${vistaActual === "ajustes" ? "active" : ""}`}
              onClick={() => setVistaActual("ajustes")}
            >
              Ajustes
            </button>
          )}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>
              {vistaActual === "ajustes" ? "Ajustes" : "Dashboard principal"}
            </h1>
            <p>Gestion multiempresa, usuarios y datos operativos.</p>
          </div>

          <div className="topbar-actions">
            <div className="empresa-selector">
              <select
                value={empresaScope}
                onChange={(event) => void cambiarEmpresaScope(event.target.value)}
              >
                <option value="all">Todas las empresas</option>
                <option value="custom">Empresas seleccionadas</option>
              </select>

              {empresaScope === "custom" && (
                <div className="empresa-checks">
                  {empresas.map((empresa) => (
                    <label key={empresa.id}>
                      <input
                        type="checkbox"
                        checked={empresasSeleccionadas.includes(empresa.id)}
                        onChange={() => void toggleEmpresaSeleccionada(empresa.id)}
                      />
                      {empresa.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="user-box">
              <span>{usuario?.nombre || "Usuario"}</span>
              <button onClick={logout}>Salir</button>
            </div>
          </div>
        </header>

        {error && <p className="error">{error}</p>}
        {mensaje && <p className="success">{mensaje}</p>}

        {vistaActual === "dashboard" && dashboard && (
          <>
            <section className="cards-grid">
              <article className="metric-card">
                <span>Ventas totales</span>
                <strong>Q {dashboard.ventas_totales.toFixed(2)}</strong>
                <small>Segun empresas seleccionadas</small>
              </article>

              <article className="metric-card">
                <span>Alertas activas</span>
                <strong>{dashboard.alertas_count}</strong>
                <small>Productos con stock critico</small>
              </article>

              <article className="metric-card">
                <span>Empresas visibles</span>
                <strong>{empresaScope === "all" ? empresas.length : empresasSeleccionadas.length}</strong>
                <small>Permisos del usuario actual</small>
              </article>

              <article className="metric-card">
                <span>Top productos</span>
                <strong>{dashboard.top_productos.length}</strong>
                <small>Productos mas vendidos</small>
              </article>
            </section>

            <section className="main-grid">
              <article className="panel">
                <h2>Comparativa por canal</h2>
                <DataTable
                  columns={["Canal", "Total"]}
                  rows={dashboard.comparativa_canales}
                  renderRow={(item) => [
                    item.canal,
                    `Q ${Number(item.total).toFixed(2)}`,
                  ]}
                />
              </article>

              <article className="panel">
                <h2>Top productos</h2>
                <DataTable
                  columns={["Producto", "Unidades"]}
                  rows={dashboard.top_productos}
                  renderRow={(item) => [item.cod_producto, item.total_vendido]}
                />
              </article>
            </section>

            <AlertasPanel alertas={alertas} />
          </>
        )}

        {vistaActual === "ventas" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Modulo de ventas</h2>
                <p>Listado filtrado por las empresas seleccionadas.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void descargarReporte("ventas")}
              >
                Descargar Excel
              </button>
            </div>

            <DataTable
              columns={["Fecha", "Producto", "Canal", "Cantidad", "Precio", "Total"]}
              rows={ventas}
              renderRow={(venta) => [
                new Date(venta.fecha).toLocaleDateString(),
                venta.producto,
                venta.canal,
                venta.cantidad,
                `Q ${Number(venta.precio_unitario).toFixed(2)}`,
                `Q ${Number(venta.total).toFixed(2)}`,
              ]}
            />
          </section>
        )}

        {vistaActual === "inventario" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Modulo de inventario</h2>
                <p>Stock filtrado por las empresas seleccionadas.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void descargarReporte("inventario")}
              >
                Descargar Excel
              </button>
            </div>

            <DataTable
              columns={[
                "Codigo",
                "Producto",
                "Categoria",
                "Stock fisico",
                "Stock reportado",
                "Stock minimo",
                "Estado",
              ]}
              rows={inventario}
              renderRow={(item) => [
                item.cod_producto,
                item.nombre,
                item.categoria,
                item.stock_fisico,
                item.stock_reportado,
                item.stock_minimo,
                <span key={item.id} className={`badge ${item.estado.toLowerCase()}`}>
                  {item.estado}
                </span>,
              ]}
            />
          </section>
        )}

        {vistaActual === "reportes" && (
          <section className="panel">
            <h2>Reportes</h2>
            <p>Descarga reportes operativos filtrados por empresa.</p>

            <div className="report-buttons">
              <button onClick={() => void descargarReporte("ventas")}>
                Descargar ventas Excel
              </button>

              <button onClick={() => void descargarReporte("inventario")}>
                Descargar inventario Excel
              </button>
            </div>
          </section>
        )}

        {vistaActual === "auditoria" && (
          <section className="panel">
            <h2>Auditoria</h2>
            <p>La auditoria queda preparada para eventos de ajustes y reportes.</p>
          </section>
        )}

        {vistaActual === "ajustes" && puedeAdministrar && (
          <section className="panel">
            <div className="tabs">
              {["empresas", "usuarios", "roles"].map((tab) => (
                <button
                  key={tab}
                  className={tabAjustes === tab ? "active" : ""}
                  onClick={() => setTabAjustes(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {tabAjustes === "empresas" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearEmpresa}>
                  <h2>Nueva empresa</h2>
                  <input
                    value={empresaForm.nombre}
                    onChange={(event) =>
                      setEmpresaForm({ ...empresaForm, nombre: event.target.value })
                    }
                    placeholder="Nombre"
                  />
                  <input
                    value={empresaForm.nit}
                    onChange={(event) =>
                      setEmpresaForm({ ...empresaForm, nit: event.target.value })
                    }
                    placeholder="NIT"
                  />
                  <input
                    value={empresaForm.telefono}
                    onChange={(event) =>
                      setEmpresaForm({ ...empresaForm, telefono: event.target.value })
                    }
                    placeholder="Telefono"
                  />
                  <input
                    value={empresaForm.email}
                    onChange={(event) =>
                      setEmpresaForm({ ...empresaForm, email: event.target.value })
                    }
                    placeholder="Email"
                  />
                  <input
                    value={empresaForm.direccion}
                    onChange={(event) =>
                      setEmpresaForm({ ...empresaForm, direccion: event.target.value })
                    }
                    placeholder="Direccion"
                  />
                  <button type="submit">Crear empresa</button>
                </form>

                <div>
                  <h2>Empresas</h2>
                  <DataTable
                    columns={["Nombre", "NIT", "Estado", "Accion"]}
                    rows={empresas}
                    renderRow={(empresa) => [
                      empresa.nombre,
                      empresa.nit || "-",
                      <span key={empresa.id} className={`badge ${empresa.estado}`}>
                        {empresa.estado}
                      </span>,
                      <button
                        key={`${empresa.id}-accion`}
                        className="table-action"
                        onClick={() => void cambiarEstadoEmpresa(empresa)}
                      >
                        {empresa.estado === "activa" ? "Desactivar" : "Activar"}
                      </button>,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabAjustes === "usuarios" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearUsuario}>
                  <h2>Nuevo usuario</h2>
                  <input
                    value={usuarioForm.nombre}
                    onChange={(event) =>
                      setUsuarioForm({ ...usuarioForm, nombre: event.target.value })
                    }
                    placeholder="Nombre"
                  />
                  <input
                    value={usuarioForm.email}
                    onChange={(event) =>
                      setUsuarioForm({ ...usuarioForm, email: event.target.value })
                    }
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    value={usuarioForm.password}
                    onChange={(event) =>
                      setUsuarioForm({ ...usuarioForm, password: event.target.value })
                    }
                    placeholder="Contrasena temporal"
                  />
                  <select
                    value={usuarioForm.rol}
                    onChange={(event) =>
                      setUsuarioForm({ ...usuarioForm, rol: event.target.value })
                    }
                  >
                    {ROLES.map((rol) => (
                      <option key={rol} value={rol}>
                        {rol}
                      </option>
                    ))}
                  </select>

                  <div className="checkbox-list">
                    {empresas.map((empresa) => (
                      <label key={empresa.id}>
                        <input
                          type="checkbox"
                          checked={usuarioForm.empresas.includes(empresa.id)}
                          onChange={() => {
                            const nextEmpresas = usuarioForm.empresas.includes(empresa.id)
                              ? usuarioForm.empresas.filter((id) => id !== empresa.id)
                              : [...usuarioForm.empresas, empresa.id];
                            setUsuarioForm({
                              ...usuarioForm,
                              empresas: nextEmpresas,
                            });
                          }}
                        />
                        {empresa.nombre}
                      </label>
                    ))}
                  </div>

                  <button type="submit">Crear usuario</button>
                </form>

                <div>
                  <h2>Usuarios</h2>
                  <DataTable
                    columns={["Nombre", "Email", "Rol", "Empresas", "Estado", "Accion"]}
                    rows={usuarios}
                    renderRow={(user) => [
                      user.nombre,
                      user.email,
                      user.rol,
                      user.empresas.map((empresa) => empresa.empresa).join(", ") || "-",
                      user.activo ? "Activo" : "Inactivo",
                      <button
                        key={`${user.id}-accion`}
                        className="table-action"
                        onClick={() => void cambiarEstadoUsuario(user)}
                      >
                        {user.activo ? "Desactivar" : "Activar"}
                      </button>,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabAjustes === "roles" && (
              <div>
                <h2>Roles disponibles</h2>
                <div className="role-grid">
                  {ROLES.map((rol) => (
                    <article key={rol} className="role-card">
                      <strong>{rol}</strong>
                      <span>
                        {rol === "admin"
                          ? "Administra empresas, usuarios y permisos."
                          : "Acceso operativo segun empresas asignadas."}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function DataTable({ columns, rows, renderRow }) {
  if (!rows || rows.length === 0) {
    return <p className="empty-state">No hay datos para mostrar.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.cod_producto || row.canal || rowIndex}>
              {renderRow(row).map((cell, cellIndex) => (
                <td key={`${row.id || rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertasPanel({ alertas }) {
  return (
    <section className="panel">
      <h2>Alertas de inventario</h2>

      <DataTable
        columns={["Producto", "Codigo", "Stock actual", "Stock minimo", "Severidad"]}
        rows={alertas}
        renderRow={(alerta) => [
          alerta.nombre,
          alerta.cod_producto,
          alerta.stock_actual,
          alerta.stock_minimo,
          <span key={alerta.id} className={`badge ${alerta.severidad.toLowerCase()}`}>
            {alerta.severidad}
          </span>,
        ]}
      />
    </section>
  );
}

export default App;
