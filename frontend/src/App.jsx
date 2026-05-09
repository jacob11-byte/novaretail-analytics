import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [email, setEmail] = useState("admin@novaretail.com");
  const [password, setPassword] = useState("Admin12345");
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [usuario, setUsuario] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState("");
  const [vistaActual, setVistaActual] = useState("dashboard");
  const [ventas, setVentas] = useState([]);
  const [inventario, setInventario] = useState([]);

  async function login(e) {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      setUsuario(response.data.user);
    } catch (error) {
      setError("Credenciales inválidas o error de conexión.");
    }
  }

  async function cargarDashboard(tokenActual) {
    const response = await axios.get(`${API_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${tokenActual}`,
      },
    });

    setDashboard(response.data);
  }

  async function cargarAlertas(tokenActual) {
    const response = await axios.get(`${API_URL}/alertas`, {
      headers: {
        Authorization: `Bearer ${tokenActual}`,
      },
    });

    setAlertas(response.data.alertas);
  }

  async function cargarVentas(tokenActual) {
  const response = await axios.get(`${API_URL}/ventas`, {
    headers: {
      Authorization: `Bearer ${tokenActual}`,
    },
  });

  setVentas(response.data.ventas);
}

async function cargarInventario(tokenActual) {
  const response = await axios.get(`${API_URL}/inventario`, {
    headers: {
      Authorization: `Bearer ${tokenActual}`,
    },
  });

  setInventario(response.data.inventario);
}

  async function cargarDatos() {
  try {
    await cargarDashboard(token);
    await cargarAlertas(token);
    await cargarVentas(token);
    await cargarInventario(token);
  } catch (error) {
    setError("No se pudieron cargar los datos del sistema.");
  }
}

  useEffect(() => {
    if (token) {
      cargarDatos();
    }
  }, [token]);

  function logout() {
  localStorage.removeItem("token");
  setToken(null);
  setUsuario(null);
  setDashboard(null);
  setAlertas([]);
  setVentas([]);
  setInventario([]);
  setVistaActual("dashboard");
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
  } catch (error) {
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
              <p>Panel de análisis para ventas e inventario</p>
            </div>
          </div>

          <form onSubmit={login}>
            <label>Correo electrónico</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@novaretail.com"
            />

            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin12345"
            />

            {error && <p className="error">{error}</p>}

            <button type="submit">Iniciar sesión</button>
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
  <button
    className={`menu-link ${vistaActual === "dashboard" ? "active" : ""}`}
    onClick={() => setVistaActual("dashboard")}
  >
    Dashboard
  </button>

  <button
    className={`menu-link ${vistaActual === "ventas" ? "active" : ""}`}
    onClick={() => setVistaActual("ventas")}
  >
    Ventas
  </button>

  <button
    className={`menu-link ${vistaActual === "inventario" ? "active" : ""}`}
    onClick={() => setVistaActual("inventario")}
  >
    Inventario
  </button>

  <button
    className={`menu-link ${vistaActual === "reportes" ? "active" : ""}`}
    onClick={() => setVistaActual("reportes")}
  >
    Reportes
  </button>

  <button
    className={`menu-link ${vistaActual === "auditoria" ? "active" : ""}`}
    onClick={() => setVistaActual("auditoria")}
  >
    Auditoría
  </button>
</nav>
      </aside>

      <section className="content">
        <header className="topbar">
  <div>
    <h1>Dashboard principal</h1>
    <p>
      Resumen de ventas, canales, productos destacados y alertas de
      inventario.
    </p>
  </div>

  <div className="topbar-actions">
    <button
      className="secondary-button"
      onClick={() => descargarReporte("ventas")}
    >
      Descargar ventas Excel
    </button>

    <button
      className="secondary-button"
      onClick={() => descargarReporte("inventario")}
    >
      Descargar inventario Excel
    </button>

    <div className="user-box">
      <span>{usuario?.nombre || "Administrador"}</span>
      <button onClick={logout}>Salir</button>
    </div>
  </div>
</header>

        {error && <p className="error">{error}</p>}

        {vistaActual === "dashboard" && dashboard && (
  <>
    <section className="cards-grid">
      <article className="metric-card">
        <span>Ventas totales</span>
        <strong>Q {dashboard.ventas_totales.toFixed(2)}</strong>
        <small>Rango actual de análisis</small>
      </article>

      <article className="metric-card">
        <span>Alertas activas</span>
        <strong>{dashboard.alertas_count}</strong>
        <small>Productos con stock crítico</small>
      </article>

      <article className="metric-card">
        <span>Canales evaluados</span>
        <strong>{dashboard.comparativa_canales.length}</strong>
        <small>Física, WhatsApp y online</small>
      </article>

      <article className="metric-card">
        <span>Top productos</span>
        <strong>{dashboard.top_productos.length}</strong>
        <small>Productos más vendidos</small>
      </article>
    </section>

    <section className="main-grid">
      <article className="panel">
        <h2>Comparativa por canal</h2>
        <table>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.comparativa_canales.map((item) => (
              <tr key={item.canal}>
                <td>{item.canal}</td>
                <td>Q {Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel">
        <h2>Top productos</h2>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Unidades</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.top_productos.map((item) => (
              <tr key={item.cod_producto}>
                <td>{item.cod_producto}</td>
                <td>{item.total_vendido}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>

    <section className="panel">
      <h2>Alertas de inventario</h2>

      {alertas.length === 0 ? (
        <p>No hay alertas activas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código</th>
              <th>Stock actual</th>
              <th>Stock mínimo</th>
              <th>Severidad</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((alerta) => (
              <tr key={alerta.id}>
                <td>{alerta.nombre}</td>
                <td>{alerta.cod_producto}</td>
                <td>{alerta.stock_actual}</td>
                <td>{alerta.stock_minimo}</td>
                <td>
                  <span className={`badge ${alerta.severidad.toLowerCase()}`}>
                    {alerta.severidad}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  </>
)}

{vistaActual === "ventas" && (
  <section className="panel">
    <div className="panel-header">
      <div>
        <h2>Módulo de ventas</h2>
        <p>Listado de ventas registradas por canal y producto.</p>
      </div>

      <button
        className="secondary-button"
        onClick={() => descargarReporte("ventas")}
      >
        Descargar Excel
      </button>
    </div>

    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Producto</th>
          <th>Canal</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {ventas.map((venta) => (
          <tr key={venta.id}>
            <td>{new Date(venta.fecha).toLocaleDateString()}</td>
            <td>{venta.producto}</td>
            <td>{venta.canal}</td>
            <td>{venta.cantidad}</td>
            <td>Q {Number(venta.precio_unitario).toFixed(2)}</td>
            <td>Q {Number(venta.total).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}

{vistaActual === "inventario" && (
  <section className="panel">
    <div className="panel-header">
      <div>
        <h2>Módulo de inventario</h2>
        <p>Control de stock físico, stock reportado y estado del producto.</p>
      </div>

      <button
        className="secondary-button"
        onClick={() => descargarReporte("inventario")}
      >
        Descargar Excel
      </button>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th>Categoría</th>
          <th>Stock físico</th>
          <th>Stock reportado</th>
          <th>Stock mínimo</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {inventario.map((item) => (
          <tr key={item.id}>
            <td>{item.cod_producto}</td>
            <td>{item.nombre}</td>
            <td>{item.categoria}</td>
            <td>{item.stock_fisico}</td>
            <td>{item.stock_reportado}</td>
            <td>{item.stock_minimo}</td>
            <td>
              <span className={`badge ${item.estado.toLowerCase()}`}>
                {item.estado}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}

{vistaActual === "reportes" && (
  <section className="panel">
    <h2>Reportes</h2>
    <p>Descarga reportes operativos en formato Excel.</p>

    <div className="report-buttons">
      <button onClick={() => descargarReporte("ventas")}>
        Descargar ventas Excel
      </button>

      <button onClick={() => descargarReporte("inventario")}>
        Descargar inventario Excel
      </button>
    </div>
  </section>
)}

{vistaActual === "auditoria" && (
  <section className="panel">
    <h2>Auditoría</h2>
    <p>
      Este módulo mostrará los eventos del sistema, inicios de sesión,
      descargas y cambios importantes.
    </p>
  </section>
)}

        <section className="panel">
          <h2>Alertas de inventario</h2>

          {alertas.length === 0 ? (
            <p>No hay alertas activas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                  <th>Severidad</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((alerta) => (
                  <tr key={alerta.id}>
                    <td>{alerta.nombre}</td>
                    <td>{alerta.cod_producto}</td>
                    <td>{alerta.stock_actual}</td>
                    <td>{alerta.stock_minimo}</td>
                    <td>
                      <span className={`badge ${alerta.severidad.toLowerCase()}`}>
                        {alerta.severidad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;