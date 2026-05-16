import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from "recharts";
import "./App.css";

function Icon({ name, size = 18 }) {
  const icons = {
    dashboard:   "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    ventas:      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    pos:         "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
    compras:     "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
    facturas:    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    inventario:  "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    empleados:   "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    vacaciones:  "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    reportes:    "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    auditoria:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    ajustes:     "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    plus:        "M12 5v14M5 12h14",
    search:      "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    x:           "M6 18L18 6M6 6l12 12",
    download:    "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
    logout:      "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    check:       "M5 13l4 4L19 7",
  };
  const d = icons[name];
  if (!d) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

function Modal({ open, onClose, title, error, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <p className="modal-error">{error}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

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

const emptyCliente = {
  nombre: "",
  nit: "",
  telefono: "",
  email: "",
  direccion: "",
};

const emptyDocumentoVenta = {
  cliente_id: "",
  fecha_vencimiento: "",
  orden_despacho: "",
  descripcion: "",
  cantidad: 1,
  unidad: "unidad",
  precio_unitario: 0,
  impuesto_porcentaje: 12,
};

const emptyProducto = {
  cod_producto: "",
  nombre: "",
  categoria: "",
  tipo: "producto",
  descripcion: "",
  stock_minimo: 10,
  precio_venta: 0,
  stock_inicial: 0,
};

const emptyCategoria = {
  nombre: "",
  descripcion: "",
};

const emptyProveedor = {
  nombre: "",
  nit: "",
  telefono: "",
  email: "",
  direccion: "",
};

const emptyCompra = {
  id: "",
  proveedor_id: "",
  cod_producto: "",
  descripcion: "",
  cantidad: 1,
  costo_unitario: 0,
  estado: "borrador",
};

const emptyAjusteInventario = {
  cod_producto: "",
  tipo_operacion: "aumentar",
  cantidad: 1,
  referencia: "",
};

const emptyFactura = {
  id: "",
  empresa_id: "",
  cliente_id: "",
  fecha: "",
  notas: "",
  cod_producto: "",
  descripcion: "",
  cantidad: 1,
  precio_unitario: 0,
  impuesto_porcentaje: 12,
};

const emptyEmpleado = {
  codigo: "",
  nombre: "",
  dpi: "",
  telefono: "",
  email: "",
  direccion: "",
  puesto: "",
  departamento: "",
  fecha_ingreso: "",
  salario_base: 0,
};

const emptyVacaciones = {
  empleado_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  motivo: "",
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
  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriasProductos, setCategoriasProductos] = useState([]);
  const [productosPos, setProductosPos] = useState([]);
  const [carritoPos, setCarritoPos] = useState([]);
  const [ventasPosDia, setVentasPosDia] = useState([]);
  const [cortesCaja, setCortesCaja] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [kardex, setKardex] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [movimientosInventario, setMovimientosInventario] = useState([]);
  const [eventosAuditoria, setEventosAuditoria] = useState([]);
  const [reporteActual, setReporteActual] = useState(null);
  const [busquedaPos, setBusquedaPos] = useState("");
  const [metodoPagoPos, setMetodoPagoPos] = useState("efectivo");
  const [descuentoPos, setDescuentoPos] = useState(0);
  const [montoInicialCaja, setMontoInicialCaja] = useState(0);
  const [kardexProducto, setKardexProducto] = useState("");
  const [empresaScope, setEmpresaScope] = useState("all");
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState([]);
  const [vistaActual, setVistaActual] = useState("dashboard");
  const [tabVentas, setTabVentas] = useState("cotizaciones");
  const [tabCompras, setTabCompras] = useState("ordenes");
  const [tabInventario, setTabInventario] = useState("stock");
  const [tabAjustes, setTabAjustes] = useState("empresas");
  const [empresaForm, setEmpresaForm] = useState(emptyEmpresa);
  const [usuarioForm, setUsuarioForm] = useState(emptyUsuario);
  const [clienteForm, setClienteForm] = useState(emptyCliente);
  const [cotizacionForm, setCotizacionForm] = useState(emptyDocumentoVenta);
  const [ordenForm, setOrdenForm] = useState(emptyDocumentoVenta);
  const [productoForm, setProductoForm] = useState(emptyProducto);
  const [categoriaForm, setCategoriaForm] = useState(emptyCategoria);
  const [proveedorForm, setProveedorForm] = useState(emptyProveedor);
  const [compraForm, setCompraForm] = useState(emptyCompra);
  const [ajusteInventarioForm, setAjusteInventarioForm] = useState(
    emptyAjusteInventario
  );
  const [facturaForm, setFacturaForm] = useState(emptyFactura);
  const [empleadoForm, setEmpleadoForm] = useState(emptyEmpleado);
  const [vacacionesForm, setVacacionesForm] = useState(emptyVacaciones);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [modalActivo, setModalActivo] = useState(null);
  const [busquedaVentas, setBusquedaVentas] = useState("");
  const [busquedaClientes, setBusquedaClientes] = useState("");
  const [busquedaCompras, setBusquedaCompras] = useState("");
  const [busquedaProveedores, setBusquedaProveedores] = useState("");
  const [busquedaFacturas, setBusquedaFacturas] = useState("");
  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [busquedaProductos, setBusquedaProductos] = useState("");
  const [busquedaEmpleados, setBusquedaEmpleados] = useState("");
  const [busquedaVacaciones, setBusquedaVacaciones] = useState("");

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
  const empresaActivaId =
    empresasSeleccionadas[0] || usuario?.empresas?.[0]?.id || empresas[0]?.id || "";

  const cargarDatos = useCallback(
    async (queryEmpresa = empresaQuery) => {
      if (!token) {
        return;
      }

      const params = { empresa_id: queryEmpresa };
      const requests = await Promise.allSettled([
        axios.get(`${API_URL}/dashboard`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/alertas`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/ventas`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/inventario`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/clientes`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/cotizaciones`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/ordenes-venta`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/pos/ventas-dia`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/pos/cortes`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/productos`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/categorias-productos`, {
          headers: authHeaders,
          params,
        }),
        axios.get(`${API_URL}/proveedores`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/compras`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/facturas`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/empleados`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/vacaciones`, { headers: authHeaders, params }),
        axios.get(`${API_URL}/inventario/movimientos`, {
          headers: authHeaders,
          params,
        }),
        axios.get(`${API_URL}/auditoria`, { headers: authHeaders, params }),
      ]);
      const [
        dashboardRes,
        alertasRes,
        ventasRes,
        inventarioRes,
        clientesRes,
        cotizacionesRes,
        ordenesRes,
        ventasPosRes,
        cortesRes,
        productosRes,
        categoriasRes,
        proveedoresRes,
        comprasRes,
        facturasRes,
        empleadosRes,
        vacacionesRes,
        movimientosRes,
        auditoriaRes,
      ] = requests;
      const failed = requests.some((request) => request.status === "rejected");

      if (dashboardRes.status === "fulfilled") setDashboard(dashboardRes.value.data);
      if (alertasRes.status === "fulfilled") setAlertas(alertasRes.value.data.alertas);
      if (ventasRes.status === "fulfilled") setVentas(ventasRes.value.data.ventas);
      if (inventarioRes.status === "fulfilled") {
        setInventario(inventarioRes.value.data.inventario);
      }
      if (clientesRes.status === "fulfilled") setClientes(clientesRes.value.data.clientes);
      if (cotizacionesRes.status === "fulfilled") {
        setCotizaciones(cotizacionesRes.value.data.cotizaciones);
      }
      if (ordenesRes.status === "fulfilled") setOrdenesVenta(ordenesRes.value.data.ordenes);
      if (ventasPosRes.status === "fulfilled") setVentasPosDia(ventasPosRes.value.data.ventas);
      if (cortesRes.status === "fulfilled") setCortesCaja(cortesRes.value.data.cortes);
      if (productosRes.status === "fulfilled") setProductos(productosRes.value.data.productos);
      if (categoriasRes.status === "fulfilled") {
        setCategoriasProductos(categoriasRes.value.data.categorias);
      }
      if (proveedoresRes.status === "fulfilled") {
        setProveedores(proveedoresRes.value.data.proveedores);
      }
      if (comprasRes.status === "fulfilled") {
        setCompras(comprasRes.value.data.compras);
      }
      if (facturasRes.status === "fulfilled") {
        setFacturas(facturasRes.value.data.facturas);
      }
      if (empleadosRes.status === "fulfilled") {
        setEmpleados(empleadosRes.value.data.empleados);
      }
      if (vacacionesRes.status === "fulfilled") {
        setVacaciones(vacacionesRes.value.data.vacaciones);
      }
      if (movimientosRes.status === "fulfilled") {
        setMovimientosInventario(movimientosRes.value.data.movimientos);
      }
      if (auditoriaRes.status === "fulfilled") {
        setEventosAuditoria(auditoriaRes.value.data.eventos);
      }

      if (failed) {
        setError("Algunos modulos no cargaron. Revisa que los SQL esten ejecutados.");
      } else {
        setError("");
      }
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
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError("Tu sesion expiro. Inicia sesion nuevamente.");
      } else {
        setError("No se pudieron cargar algunos datos del sistema.");
      }
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
    setClientes([]);
    setCotizaciones([]);
    setOrdenesVenta([]);
    setInventario([]);
    setProductos([]);
    setCategoriasProductos([]);
    setProductosPos([]);
    setCarritoPos([]);
    setVentasPosDia([]);
    setCortesCaja([]);
    setProveedores([]);
    setCompras([]);
    setKardex([]);
    setFacturas([]);
    setEmpleados([]);
    setVacaciones([]);
    setMovimientosInventario([]);
    setEventosAuditoria([]);
    setReporteActual(null);
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

  function construirLineaDocumento(form) {
    return [
      {
        descripcion: form.descripcion || "Linea de venta",
        cantidad: Number(form.cantidad || 0),
        unidad: form.unidad || "unidad",
        precio_unitario: Number(form.precio_unitario || 0),
        impuesto_porcentaje: Number(form.impuesto_porcentaje || 0),
      },
    ];
  }

  async function crearCliente(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/clientes`,
        { ...clienteForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setClienteForm(emptyCliente);
      await cargarDatos();
      setMensaje("Cliente creado correctamente.");
    } catch {
      setError("No se pudo crear el cliente.");
    }
  }

  async function crearCotizacion(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/cotizaciones`,
        {
          empresa_id: empresaActivaId,
          cliente_id: cotizacionForm.cliente_id || null,
          fecha_vencimiento: cotizacionForm.fecha_vencimiento || null,
          lineas: construirLineaDocumento(cotizacionForm),
        },
        { headers: authHeaders }
      );
      setCotizacionForm(emptyDocumentoVenta);
      await cargarDatos();
      setMensaje("Cotizacion creada correctamente.");
    } catch {
      setError("No se pudo crear la cotizacion.");
    }
  }

  async function confirmarCotizacion(cotizacionId) {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/cotizaciones/${cotizacionId}/confirmar`,
        {},
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Cotizacion confirmada como orden de venta.");
    } catch {
      setError("No se pudo confirmar la cotizacion.");
    }
  }

  async function crearOrdenVenta(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/ordenes-venta`,
        {
          empresa_id: empresaActivaId,
          cliente_id: ordenForm.cliente_id || null,
          orden_despacho: ordenForm.orden_despacho || null,
          lineas: construirLineaDocumento(ordenForm),
        },
        { headers: authHeaders }
      );
      setOrdenForm(emptyDocumentoVenta);
      await cargarDatos();
      setMensaje("Orden de venta creada correctamente.");
    } catch {
      setError("No se pudo crear la orden de venta.");
    }
  }

  async function cancelarOrdenVenta(ordenId) {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/ordenes-venta/${ordenId}/cancelar`,
        {},
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Orden de venta cancelada.");
    } catch {
      setError("No se pudo cancelar la orden de venta.");
    }
  }

  async function buscarProductosPos(query = busquedaPos) {
    setError("");

    try {
      const response = await axios.get(`${API_URL}/pos/productos`, {
        headers: authHeaders,
        params: {
          empresa_id: empresaActivaId || empresaQuery,
          q: query,
        },
      });
      setProductosPos(response.data.productos);
    } catch {
      setError("No se pudieron buscar productos para POS.");
    }
  }

  function agregarProductoPos(producto) {
    setCarritoPos((current) => {
      const existente = current.find(
        (item) => item.cod_producto === producto.cod_producto
      );

      if (existente) {
        return current.map((item) =>
          item.cod_producto === producto.cod_producto
            ? { ...item, cantidad: Number(item.cantidad) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          cod_producto: producto.cod_producto,
          descripcion: producto.nombre,
          cantidad: 1,
          precio_unitario: Number(producto.precio_unitario || 0),
        },
      ];
    });
  }

  function actualizarCantidadPos(codProducto, cantidad) {
    setCarritoPos((current) =>
      current
        .map((item) =>
          item.cod_producto === codProducto
            ? { ...item, cantidad: Number(cantidad || 0) }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  }

  async function finalizarVentaPos() {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/pos/venta`,
        {
          empresa_id: empresaActivaId,
          items: carritoPos,
          descuento: Number(descuentoPos || 0),
          metodo_pago: metodoPagoPos,
        },
        { headers: authHeaders }
      );
      setCarritoPos([]);
      setDescuentoPos(0);
      await cargarDatos();
      await buscarProductosPos();
      setMensaje("Venta POS finalizada correctamente.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "No se pudo finalizar la venta POS. Revisa stock y productos."
      );
    }
  }

  async function abrirCorteCaja() {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/pos/corte`,
        {
          empresa_id: empresaActivaId,
          monto_inicial: Number(montoInicialCaja || 0),
        },
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Corte de caja abierto.");
    } catch {
      setError("No se pudo abrir el corte de caja.");
    }
  }

  async function cerrarCorteCaja() {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/pos/corte`,
        {
          empresa_id: empresaActivaId,
          cerrar: true,
        },
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Corte de caja cerrado.");
    } catch {
      setError("No se pudo cerrar el corte de caja.");
    }
  }

  async function crearProducto(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/productos`,
        { ...productoForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setProductoForm(emptyProducto);
      await cargarDatos();
      setMensaje("Producto creado correctamente.");
    } catch {
      setError("No se pudo crear el producto.");
    }
  }

  async function crearCategoriaProducto(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/categorias-productos`,
        { ...categoriaForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setCategoriaForm(emptyCategoria);
      await cargarDatos();
      setMensaje("Categoria creada correctamente.");
    } catch {
      setError("No se pudo crear la categoria.");
    }
  }

  async function crearProveedor(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/proveedores`,
        { ...proveedorForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setProveedorForm(emptyProveedor);
      await cargarDatos();
      setMensaje("Proveedor creado correctamente.");
    } catch {
      setError("No se pudo crear el proveedor.");
    }
  }

  async function crearCompra(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    const productoSeleccionado = productos.find(
      (producto) => producto.cod_producto === compraForm.cod_producto
    );

    try {
      const payload = {
          empresa_id: empresaActivaId,
          proveedor_id: compraForm.proveedor_id || null,
          estado: compraForm.estado,
          lineas: [
            {
              cod_producto: compraForm.cod_producto,
              descripcion:
                compraForm.descripcion ||
                productoSeleccionado?.nombre ||
                "Producto comprado",
              cantidad: Number(compraForm.cantidad || 0),
              costo_unitario: Number(compraForm.costo_unitario || 0),
            },
          ],
        };

      if (compraForm.id) {
        await axios.put(`${API_URL}/compras/${compraForm.id}`, payload, {
          headers: authHeaders,
        });
        setMensaje("Orden de compra actualizada.");
      } else {
        await axios.post(`${API_URL}/compras`, payload, { headers: authHeaders });
        setMensaje("Orden de compra creada correctamente.");
      }

      setCompraForm(emptyCompra);
      await cargarDatos();
    } catch {
      setError("No se pudo crear la orden de compra.");
    }
  }

  async function abrirCompra(compraId) {
    setError("");

    try {
      const response = await axios.get(`${API_URL}/compras/${compraId}`, {
        headers: authHeaders,
      });
      const compra = response.data.compra;
      const primeraLinea = compra.lineas?.[0] || {};

      setCompraForm({
        id: compra.id,
        proveedor_id: compra.proveedor_id || "",
        cod_producto: primeraLinea.cod_producto || primeraLinea.producto_id || "",
        descripcion: primeraLinea.descripcion || "",
        cantidad: primeraLinea.cantidad || 1,
        costo_unitario: primeraLinea.costo_unitario || 0,
        estado: compra.estado || "borrador",
      });
      setMensaje("Orden de compra abierta.");
    } catch {
      setError("No se pudo abrir la orden de compra.");
    }
  }

  async function recibirCompra(compraId) {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/compras/${compraId}/recibir`,
        {},
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Compra recibida e inventario actualizado.");
    } catch {
      setError("No se pudo recibir la compra.");
    }
  }

  async function ajustarInventario(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    const cantidadBase = Number(ajusteInventarioForm.cantidad || 0);
    const cantidad =
      ajusteInventarioForm.tipo_operacion === "disminuir"
        ? cantidadBase * -1
        : cantidadBase;

    try {
      await axios.post(
        `${API_URL}/inventario/ajuste`,
        {
          empresa_id: empresaActivaId,
          cod_producto: ajusteInventarioForm.cod_producto,
          cantidad,
          referencia: ajusteInventarioForm.referencia,
        },
        { headers: authHeaders }
      );
      setAjusteInventarioForm(emptyAjusteInventario);
      await cargarDatos();
      setMensaje("Stock ajustado correctamente.");
    } catch {
      setError("No se pudo ajustar el stock. Revisa la cantidad disponible.");
    }
  }

  async function cargarKardex(codigoProducto = kardexProducto) {
    setError("");

    if (!codigoProducto) {
      setKardex([]);
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/inventario/kardex/${codigoProducto}`,
        {
          headers: authHeaders,
          params: { empresa_id: empresaQuery },
        }
      );
      setKardex(response.data.movimientos);
    } catch {
      setError("No se pudo cargar el Kardex del producto.");
    }
  }

  function facturaPayload(form) {
    const producto = productos.find((item) => item.cod_producto === form.cod_producto);

    return {
      empresa_id: form.empresa_id || empresaActivaId,
      cliente_id: form.cliente_id || null,
      fecha: form.fecha || null,
      notas: form.notas || null,
      lineas: [
        {
          producto_id: form.cod_producto,
          descripcion: form.descripcion || producto?.nombre || "Producto facturado",
          cantidad: Number(form.cantidad || 0),
          precio_unitario: Number(form.precio_unitario || 0),
          impuesto_porcentaje: Number(form.impuesto_porcentaje || 0),
        },
      ],
    };
  }

  async function guardarFactura(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      if (facturaForm.id) {
        await axios.put(
          `${API_URL}/facturas/${facturaForm.id}`,
          facturaPayload(facturaForm),
          { headers: authHeaders }
        );
        setMensaje("Factura actualizada en borrador.");
      } else {
        await axios.post(`${API_URL}/facturas`, facturaPayload(facturaForm), {
          headers: authHeaders,
        });
        setMensaje("Factura creada en estado borrador.");
      }

      setFacturaForm(emptyFactura);
      await cargarDatos();
    } catch {
      setError("No se pudo guardar la factura.");
    }
  }

  async function abrirFactura(facturaId) {
    setError("");

    try {
      const response = await axios.get(`${API_URL}/facturas/${facturaId}`, {
        headers: authHeaders,
      });
      const factura = response.data.factura;
      const primeraLinea = factura.lineas?.[0] || {};

      setFacturaForm({
        id: factura.id,
        empresa_id: factura.empresa_id,
        cliente_id: factura.cliente_id || "",
        fecha: factura.fecha || "",
        notas: factura.notas || "",
        cod_producto: primeraLinea.cod_producto || primeraLinea.producto_id || "",
        descripcion: primeraLinea.descripcion || "",
        cantidad: primeraLinea.cantidad || 1,
        precio_unitario: primeraLinea.precio_unitario || 0,
        impuesto_porcentaje: primeraLinea.impuesto_porcentaje || 12,
      });
      setMensaje("Factura abierta para revisar.");
    } catch {
      setError("No se pudo abrir la factura.");
    }
  }

  async function cambiarEstadoFactura(facturaId, accion) {
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/facturas/${facturaId}/${accion}`,
        {},
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Estado de factura actualizado.");
    } catch {
      setError("No se pudo cambiar el estado de la factura.");
    }
  }

  async function imprimirFactura(facturaId) {
    setError("");

    try {
      const response = await axios.get(`${API_URL}/facturas/${facturaId}/imprimir`, {
        headers: authHeaders,
        responseType: "text",
      });
      const blob = new Blob([response.data], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("No se pudo imprimir la factura.");
    }
  }

  async function crearEmpleado(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/empleados`,
        { ...empleadoForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setEmpleadoForm(emptyEmpleado);
      await cargarDatos();
      setMensaje("Empleado creado correctamente.");
    } catch {
      setError("No se pudo crear el empleado.");
    }
  }

  async function solicitarVacaciones(event) {
    event.preventDefault();
    setError("");
    setMensaje("");

    try {
      await axios.post(
        `${API_URL}/vacaciones`,
        { ...vacacionesForm, empresa_id: empresaActivaId },
        { headers: authHeaders }
      );
      setVacacionesForm(emptyVacaciones);
      await cargarDatos();
      setMensaje("Solicitud de vacaciones creada.");
    } catch {
      setError("No se pudo crear la solicitud.");
    }
  }

  async function resolverVacaciones(vacacionesId, accion) {
    setError("");
    setMensaje("");

    try {
      await axios.put(
        `${API_URL}/vacaciones/${vacacionesId}/${accion}`,
        {},
        { headers: authHeaders }
      );
      await cargarDatos();
      setMensaje("Solicitud actualizada.");
    } catch {
      setError("No se pudo actualizar la solicitud.");
    }
  }

  async function cargarReporteOperativo(tipo) {
    setError("");

    try {
      const response = await axios.get(`${API_URL}/reportes/${tipo}`, {
        headers: authHeaders,
        params: { empresa_id: empresaQuery },
      });
      setReporteActual({ tipo, data: response.data });
    } catch {
      setError("No se pudo cargar el reporte.");
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

  useEffect(() => {
    if (mensaje) setModalActivo(null);
  }, [mensaje]);

  function filtrar(rows, q, campos) {
    if (!q || !rows) return rows ?? [];
    const term = q.toLowerCase();
    return rows.filter((row) =>
      campos.some((c) => String(row[c] ?? "").toLowerCase().includes(term))
    );
  }

  const cotizacionesFiltradas = useMemo(
    () => filtrar(cotizaciones, busquedaVentas, ["numero", "cliente", "estado"]),
    [cotizaciones, busquedaVentas]
  );
  const ordenesFiltradas = useMemo(
    () => filtrar(ordenesVenta, busquedaVentas, ["numero", "cliente", "estado"]),
    [ordenesVenta, busquedaVentas]
  );
  const clientesFiltrados = useMemo(
    () => filtrar(clientes, busquedaClientes, ["nombre", "nit", "email", "telefono"]),
    [clientes, busquedaClientes]
  );
  const ventasFiltradas = useMemo(
    () => filtrar(ventas, busquedaVentas, ["producto", "canal", "fecha"]),
    [ventas, busquedaVentas]
  );
  const comprasFiltradas = useMemo(
    () => filtrar(compras, busquedaCompras, ["numero", "proveedor", "estado"]),
    [compras, busquedaCompras]
  );
  const proveedoresFiltrados = useMemo(
    () => filtrar(proveedores, busquedaProveedores, ["nombre", "nit", "email"]),
    [proveedores, busquedaProveedores]
  );
  const facturasFiltradas = useMemo(
    () => filtrar(facturas, busquedaFacturas, ["numero", "cliente", "estado"]),
    [facturas, busquedaFacturas]
  );
  const inventarioFiltrado = useMemo(
    () => filtrar(inventario, busquedaInventario, ["cod_producto", "nombre", "categoria"]),
    [inventario, busquedaInventario]
  );
  const productosFiltrados = useMemo(
    () => filtrar(productos, busquedaProductos, ["cod_producto", "nombre", "categoria"]),
    [productos, busquedaProductos]
  );
  const empleadosFiltrados = useMemo(
    () => filtrar(empleados, busquedaEmpleados, ["codigo", "nombre", "puesto", "departamento"]),
    [empleados, busquedaEmpleados]
  );
  const vacacionesFiltradas = useMemo(
    () => filtrar(vacaciones, busquedaVacaciones, ["empleado", "estado"]),
    [vacaciones, busquedaVacaciones]
  );

  if (!token) {
    return (
      <div className="login-page">
        <header className="login-shell">
          <div className="login-shell__icon">NR</div>
          NovaRetail ERP
        </header>
        <div className="login-body">
          <div className="login-card">
            <div className="login-card__header">
              <h1>Iniciar sesion</h1>
              <p>Accede al panel de gestion empresarial</p>
            </div>
            <form onSubmit={login}>
              <div className="form-field">
                <label>Correo electronico</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@novaretail.com" type="email" />
              </div>
              <div className="form-field">
                <label>Contrasena</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contrasena" />
              </div>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn-primary">Iniciar sesion</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const MENU = [
    { id: "dashboard",  label: "Dashboard",       icon: "dashboard" },
    { id: "ventas",     label: "Ventas",           icon: "ventas" },
    { id: "pos",        label: "Punto de venta",   icon: "pos" },
    { id: "compras",    label: "Compras",           icon: "compras" },
    { id: "facturas",   label: "Facturas",          icon: "facturas" },
    { id: "inventario", label: "Inventario",        icon: "inventario" },
    { id: "empleados",  label: "Empleados",         icon: "empleados" },
    { id: "vacaciones", label: "Vacaciones",        icon: "vacaciones" },
    { id: "reportes",   label: "Reportes",          icon: "reportes" },
    { id: "auditoria",  label: "Auditoria",         icon: "auditoria" },
  ];

  const MODULE_TITLES = {
    dashboard:  "Dashboard",
    ventas:     "Ventas",
    pos:        "Punto de venta",
    compras:    "Compras",
    facturas:   "Facturas",
    inventario: "Inventario",
    empleados:  "Empleados",
    vacaciones: "Vacaciones",
    reportes:   "Reportes",
    auditoria:  "Auditoria",
    ajustes:    "Ajustes",
  };

  return (
    <div className="sap-shell">
      {/* ── Shell Bar ── */}
      <header className="shell-bar">
        <div className="shell-bar__logo" onClick={() => setVistaActual("dashboard")}>
          <div className="shell-bar__logo-icon">NR</div>
          <div>
            <span className="shell-bar__logo-name">NovaRetail</span>
            <span className="shell-bar__logo-sub">ERP Analytics</span>
          </div>
        </div>

        <div className="shell-bar__spacer" />

        <div className="shell-bar__scope">
          <select value={empresaScope} onChange={(e) => void cambiarEmpresaScope(e.target.value)}>
            <option value="all">Todas las empresas</option>
            <option value="custom">Empresas seleccionadas</option>
          </select>
          {empresaScope === "custom" && (
            <div className="shell-bar__empresa-checks">
              {empresas.map((emp) => (
                <label key={emp.id}>
                  <input type="checkbox" checked={empresasSeleccionadas.includes(emp.id)} onChange={() => void toggleEmpresaSeleccionada(emp.id)} />
                  {emp.nombre}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="shell-bar__user">
          <div className="shell-bar__avatar">{(usuario?.nombre || "U").charAt(0).toUpperCase()}</div>
          <span className="shell-bar__username">{usuario?.nombre || "Usuario"} · {usuario?.rol || ""}</span>
          <button className="shell-bar__logout" onClick={logout} title="Cerrar sesion"><Icon name="logout" size={15} /></button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="sap-body">
        {/* ── Side Navigation ── */}
        <nav className="side-nav">
          <div className="side-nav__section">
            <div className="side-nav__section-title">Modulos</div>
            {MENU.map((item) => (
              <button key={item.id} className={`nav-item ${vistaActual === item.id ? "active" : ""}`} onClick={() => setVistaActual(item.id)}>
                <Icon name={item.icon} size={15} />
                {item.label}
              </button>
            ))}
          </div>
          {puedeAdministrar && (
            <div className="side-nav__section">
              <div className="side-nav__section-title">Administracion</div>
              <button className={`nav-item ${vistaActual === "ajustes" ? "active" : ""}`} onClick={() => setVistaActual("ajustes")}>
                <Icon name="ajustes" size={15} />
                Ajustes
              </button>
            </div>
          )}
        </nav>

        {/* ── Main content ── */}
        <main className="sap-page">
          <div className="page-header">
            <div>
              <div className="page-header__title">{MODULE_TITLES[vistaActual] || "NovaRetail"}</div>
              <div className="page-header__sub">NovaRetail ERP · {empresaScope === "all" ? "Todas las empresas" : `${empresasSeleccionadas.length} empresa(s) seleccionada(s)`}</div>
            </div>
          </div>

          <div className="page-body">
          {error && !modalActivo && <p className="error" style={{ marginBottom: 14 }}>{error}</p>}
          {mensaje && <p className="success" style={{ marginBottom: 14 }}>{mensaje}</p>}

        {vistaActual === "dashboard" && dashboard && (
          <>
            <div className="kpi-tiles">
              <article className="kpi-tile kpi-tile--green">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="ventas" size={18} /></div></div>
                <span className="kpi-tile__value">Q {dashboard.ventas_totales.toFixed(2)}</span>
                <span className="kpi-tile__label">Ventas totales</span>
                <span className="kpi-tile__sub">Segun empresas seleccionadas</span>
              </article>
              <article className="kpi-tile kpi-tile--blue">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="ventas" size={18} /></div></div>
                <span className="kpi-tile__value">Q {Number(dashboard.ventas_mes || 0).toFixed(2)}</span>
                <span className="kpi-tile__label">Ventas del mes</span>
                <span className="kpi-tile__sub">Periodo actual</span>
              </article>
              <article className="kpi-tile kpi-tile--red">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="inventario" size={18} /></div></div>
                <span className="kpi-tile__value">{dashboard.alertas_count}</span>
                <span className="kpi-tile__label">Alertas de stock</span>
                <span className="kpi-tile__sub">Productos criticos</span>
              </article>
              <article className="kpi-tile kpi-tile--orange">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="compras" size={18} /></div></div>
                <span className="kpi-tile__value">Q {Number(dashboard.compras_mes || 0).toFixed(2)}</span>
                <span className="kpi-tile__label">Compras del mes</span>
                <span className="kpi-tile__sub">Ordenes registradas</span>
              </article>
              <article className="kpi-tile kpi-tile--teal">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="ventas" size={18} /></div></div>
                <span className="kpi-tile__value">{dashboard.ordenes_pendientes || 0}</span>
                <span className="kpi-tile__label">Ordenes pendientes</span>
                <span className="kpi-tile__sub">Ordenes de venta activas</span>
              </article>
              <article className="kpi-tile kpi-tile--blue">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="facturas" size={18} /></div></div>
                <span className="kpi-tile__value">{dashboard.cotizaciones_pendientes || 0}</span>
                <span className="kpi-tile__label">Cotizaciones</span>
                <span className="kpi-tile__sub">Por confirmar</span>
              </article>
              <article className="kpi-tile kpi-tile--green">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="empleados" size={18} /></div></div>
                <span className="kpi-tile__value">{dashboard.empleados_activos || 0}</span>
                <span className="kpi-tile__label">Empleados activos</span>
                <span className="kpi-tile__sub">Personal registrado</span>
              </article>
              <article className="kpi-tile kpi-tile--orange">
                <div className="kpi-tile__header"><div className="kpi-tile__icon"><Icon name="vacaciones" size={18} /></div></div>
                <span className="kpi-tile__value">{dashboard.vacaciones_pendientes || 0}</span>
                <span className="kpi-tile__label">Vacaciones pendientes</span>
                <span className="kpi-tile__sub">Solicitudes por aprobar</span>
              </article>
            </div>

            <div className="dash-grid-2">
              <div className="panel">
                <div className="panel-title">Ventas por canal</div>
                <DataTable
                  columns={["Canal", "Total"]}
                  rows={dashboard.comparativa_canales}
                  renderRow={(item) => [item.canal, `Q ${Number(item.total).toFixed(2)}`]}
                />
              </div>
              <div className="panel">
                <div className="panel-title">Top 10 productos</div>
                <DataTable
                  columns={["Producto", "Unidades vendidas"]}
                  rows={dashboard.top_productos}
                  renderRow={(item) => [item.cod_producto, item.total_vendido]}
                />
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-title">Ultimos movimientos de inventario</div>
              <DataTable
                columns={["Fecha", "Producto", "Tipo", "Cantidad", "Stock nuevo"]}
                rows={dashboard.ultimos_movimientos || []}
                renderRow={(m) => [
                  new Date(m.created_at).toLocaleString(),
                  m.producto,
                  <span key={m.created_at} className={`badge ${m.tipo_movimiento?.includes("salida") ? "alta" : "normal"}`}>{m.tipo_movimiento}</span>,
                  m.cantidad,
                  m.stock_nuevo,
                ]}
              />
            </div>

            <AlertasPanel alertas={alertas} />

            <AnalisisVisual dashboard={dashboard} inventario={inventario} alertas={alertas} />
          </>
        )}

        {vistaActual === "ventas" && (
          <>
            <Modal open={modalActivo === "nueva_cotizacion"} onClose={() => { setModalActivo(null); setError(""); }} title="Nueva cotizacion" error={modalActivo === "nueva_cotizacion" ? error : ""}>
              <DocumentoVentaForm title="" form={cotizacionForm} setForm={setCotizacionForm} clientes={clientes} empresaActivaId={empresaActivaId} onSubmit={crearCotizacion} />
            </Modal>
            <Modal open={modalActivo === "nueva_orden"} onClose={() => { setModalActivo(null); setError(""); }} title="Nueva orden de venta" error={modalActivo === "nueva_orden" ? error : ""}>
              <DocumentoVentaForm title="" form={ordenForm} setForm={setOrdenForm} clientes={clientes} empresaActivaId={empresaActivaId} onSubmit={crearOrdenVenta} showOrdenDespacho />
            </Modal>
            <Modal open={modalActivo === "nuevo_cliente"} onClose={() => { setModalActivo(null); setError(""); setCotizacionForm(emptyDocumentoVenta); }} title="Nuevo cliente" error={modalActivo === "nuevo_cliente" ? error : ""}>
              <form onSubmit={crearCliente}>
                <div className="form-field"><label>Nombre</label><input value={clienteForm.nombre} onChange={e => setClienteForm({...clienteForm, nombre: e.target.value})} placeholder="Nombre completo" /></div>
                <div className="form-field"><label>NIT</label><input value={clienteForm.nit} onChange={e => setClienteForm({...clienteForm, nit: e.target.value})} placeholder="NIT" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Telefono</label><input value={clienteForm.telefono} onChange={e => setClienteForm({...clienteForm, telefono: e.target.value})} placeholder="Telefono" /></div>
                  <div className="form-field"><label>Email</label><input value={clienteForm.email} onChange={e => setClienteForm({...clienteForm, email: e.target.value})} placeholder="Email" /></div>
                </div>
                <div className="form-field"><label>Direccion</label><input value={clienteForm.direccion} onChange={e => setClienteForm({...clienteForm, direccion: e.target.value})} placeholder="Direccion" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId}><Icon name="check" size={14} /> Crear cliente</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div><h2>Ventas</h2><p>Cotizaciones, ordenes de venta, clientes e historial.</p></div>
              <div className="module-header__actions">
                <button className="btn-secondary" onClick={() => void descargarReporte("ventas")}><Icon name="download" size={14} /> Exportar Excel</button>
              </div>
            </div>

            <div className="tabs">
              {[["cotizaciones","Cotizaciones"],["ordenes","Ordenes de venta"],["clientes","Clientes"],["historico","Historico"]].map(([id,label]) => (
                <button key={id} className={tabVentas === id ? "active" : ""} onClick={() => { setTabVentas(id); setBusquedaVentas(""); }}>{label}</button>
              ))}
            </div>

            {tabVentas === "cotizaciones" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar cotizacion..." value={busquedaVentas} onChange={e => setBusquedaVentas(e.target.value)} /></div>
                  <span className="result-count">{cotizacionesFiltradas.length} registros</span>
                  <button className="btn-primary" onClick={() => setModalActivo("nueva_cotizacion")} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nueva cotizacion</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Numero","Cliente","Fecha","Estado","Total","Accion"]} rows={cotizacionesFiltradas}
                    renderRow={(c) => [c.numero, c.cliente, new Date(c.fecha_creacion).toLocaleDateString(),
                      <span key={c.id} className={`badge ${String(c.estado).replace("_","-")}`}>{c.estado}</span>,
                      `Q ${Number(c.total).toFixed(2)}`,
                      c.estado === "orden_venta" ? <span className="badge normal">Confirmada</span> :
                        <button className="table-action" onClick={() => void confirmarCotizacion(c.id)}>Confirmar</button>
                    ]}
                  />
                </div>
              </>
            )}

            {tabVentas === "ordenes" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar orden..." value={busquedaVentas} onChange={e => setBusquedaVentas(e.target.value)} /></div>
                  <span className="result-count">{ordenesFiltradas.length} registros</span>
                  <button className="btn-primary" onClick={() => setModalActivo("nueva_orden")} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nueva orden</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Numero","Cliente","Fecha","Estado","Total","Accion"]} rows={ordenesFiltradas}
                    renderRow={(o) => [o.numero, o.cliente, new Date(o.fecha_orden).toLocaleDateString(),
                      <span key={o.id} className={`badge ${o.estado}`}>{o.estado}</span>,
                      `Q ${Number(o.total).toFixed(2)}`,
                      o.estado === "cancelado" ? <span className="badge critica">Cancelada</span> :
                        <button className="table-action" onClick={() => void cancelarOrdenVenta(o.id)}>Cancelar</button>
                    ]}
                  />
                </div>
              </>
            )}

            {tabVentas === "clientes" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar cliente..." value={busquedaClientes} onChange={e => setBusquedaClientes(e.target.value)} /></div>
                  <span className="result-count">{clientesFiltrados.length} registros</span>
                  <button className="btn-primary" onClick={() => setModalActivo("nuevo_cliente")} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nuevo cliente</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Nombre","NIT","Telefono","Email","Empresa","Estado"]} rows={clientesFiltrados}
                    renderRow={(c) => [c.nombre, c.nit||"-", c.telefono||"-", c.email||"-", c.empresa,
                      <span key={c.id} className={`badge ${c.estado}`}>{c.estado}</span>
                    ]}
                  />
                </div>
              </>
            )}

            {tabVentas === "historico" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar..." value={busquedaVentas} onChange={e => setBusquedaVentas(e.target.value)} /></div>
                  <span className="result-count">{ventasFiltradas.length} registros</span>
                </div>
                <div className="panel">
                  <DataTable columns={["Fecha","Producto","Canal","Cantidad","Precio","Total"]} rows={ventasFiltradas}
                    renderRow={(v) => [new Date(v.fecha).toLocaleDateString(), v.producto, v.canal, v.cantidad,
                      `Q ${Number(v.precio_unitario).toFixed(2)}`, `Q ${Number(v.total).toFixed(2)}`
                    ]}
                  />
                </div>
              </>
            )}
          </>
        )}

        {vistaActual === "pos" && (
          <>
            <div className="module-header">
              <div>
                <h1><Icon name="pos" size={22} /> Punto de venta</h1>
                <p>Venta rapida con carrito, pagos y corte de caja.</p>
              </div>
              <div className="module-header__actions">
                <button className="btn-secondary" onClick={() => void buscarProductosPos()} disabled={!empresaActivaId}>
                  <Icon name="search" size={14} /> Cargar productos
                </button>
              </div>
            </div>

            <div className="pos-layout">
              <section className="pos-products-panel">
                <div className="table-toolbar" style={{marginBottom:"1rem"}}>
                  <div className="search-box">
                    <Icon name="search" size={14} />
                    <input value={busquedaPos} onChange={e => setBusquedaPos(e.target.value)} onKeyDown={e => e.key === "Enter" && void buscarProductosPos()} placeholder="Buscar por codigo o nombre..." />
                  </div>
                  <button className="btn-primary" onClick={() => void buscarProductosPos()}>Buscar</button>
                </div>
                {productosPos.length === 0 ? (
                  <div className="empty-state" style={{padding:"3rem",textAlign:"center"}}>Carga productos para empezar a vender.</div>
                ) : (
                  <div className="pos-product-grid">
                    {productosPos.map(prod => (
                      <button key={prod.cod_producto} className="pos-product-card" onClick={() => agregarProductoPos(prod)} disabled={prod.stock_fisico <= 0}>
                        <div className="pos-product-card__icon"><Icon name="inventario" size={24} /></div>
                        <div className="pos-product-card__name">{prod.nombre}</div>
                        <div className="pos-product-card__code">{prod.cod_producto}</div>
                        <div className="pos-product-card__price">Q {Number(prod.precio_unitario).toFixed(2)}</div>
                        <div className={`pos-product-card__stock ${prod.stock_fisico <= 0 ? "out" : ""}`}>Stock: {prod.stock_fisico}</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="pos-cart-panel">
                <h2 style={{fontWeight:700,fontSize:"1rem",marginBottom:"1rem",color:"var(--text)"}}>Carrito</h2>
                {carritoPos.length === 0 ? (
                  <div className="empty-state" style={{padding:"2rem",textAlign:"center",fontSize:"0.875rem"}}>Agrega productos al carrito.</div>
                ) : (
                  <div className="pos-cart-items">
                    {carritoPos.map(item => (
                      <div key={item.cod_producto} className="pos-cart-item">
                        <div className="pos-cart-item__name">{item.descripcion}</div>
                        <div className="pos-cart-item__controls">
                          <input type="number" min="0" step="1" value={item.cantidad} onChange={e => actualizarCantidadPos(item.cod_producto, e.target.value)} />
                          <span className="pos-cart-item__price">Q {(Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pos-cart-footer">
                  <div className="form-row" style={{gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <div className="form-field" style={{margin:0,flex:1}}><label>Descuento (Q)</label><input type="number" min="0" step="0.01" value={descuentoPos} onChange={e => setDescuentoPos(e.target.value)} /></div>
                    <div className="form-field" style={{margin:0,flex:1}}><label>Metodo de pago</label>
                      <select value={metodoPagoPos} onChange={e => setMetodoPagoPos(e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="mixto">Mixto</option>
                      </select>
                    </div>
                  </div>
                  <div className="pos-cart-total">
                    Total con IVA: <strong>Q {calcularTotalCarrito(carritoPos, descuentoPos).toFixed(2)}</strong>
                  </div>
                  <button className="btn-primary pos-btn-sell" onClick={() => void finalizarVentaPos()} disabled={!empresaActivaId || carritoPos.length === 0}>
                    Finalizar venta
                  </button>
                </div>
              </section>
            </div>

            <div className="main-grid" style={{marginTop:"1.5rem",gap:"1.5rem",display:"grid",gridTemplateColumns:"1fr 1fr"}}>
              <div className="panel">
                <div className="table-toolbar">
                  <h2 style={{margin:0,fontWeight:600,fontSize:"0.95rem"}}>Corte de caja</h2>
                </div>
                <div className="cash-actions" style={{display:"flex",gap:"0.5rem",marginBottom:"1rem",alignItems:"center"}}>
                  <input type="number" min="0" step="0.01" value={montoInicialCaja} onChange={e => setMontoInicialCaja(e.target.value)} placeholder="Monto inicial (Q)" style={{flex:1}} />
                  <button className="btn-primary" onClick={() => void abrirCorteCaja()} disabled={!empresaActivaId}>Abrir</button>
                  <button className="btn-secondary" onClick={() => void cerrarCorteCaja()} disabled={!empresaActivaId}>Cerrar</button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Empresa</th><th>Inicial</th><th>Ventas</th><th>Estado</th></tr></thead>
                  <tbody>
                    {cortesCaja.length === 0 ? <tr><td colSpan={4} className="empty-state">Sin cortes registrados.</td></tr>
                    : cortesCaja.map((c, i) => (
                      <tr key={i}><td>{c.empresa}</td><td>Q {Number(c.monto_inicial).toFixed(2)}</td><td>Q {Number(c.total_ventas).toFixed(2)}</td><td><span className={`badge ${c.estado === "abierto" ? "activo" : ""}`}>{c.estado}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel">
                <div className="table-toolbar">
                  <h2 style={{margin:0,fontWeight:600,fontSize:"0.95rem"}}>Ventas del dia</h2>
                  <span className="record-count">{ventasPosDia.length} ventas</span>
                </div>
                <table className="data-table">
                  <thead><tr><th>Hora</th><th>Metodo</th><th>Descuento</th><th>Total</th></tr></thead>
                  <tbody>
                    {ventasPosDia.length === 0 ? <tr><td colSpan={4} className="empty-state">Sin ventas hoy.</td></tr>
                    : ventasPosDia.map((v, i) => (
                      <tr key={i}><td>{new Date(v.fecha).toLocaleTimeString()}</td><td>{v.metodo_pago}</td><td>Q {Number(v.descuento).toFixed(2)}</td><td><strong>Q {Number(v.total).toFixed(2)}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {vistaActual === "compras" && (
          <>
            <Modal open={modalActivo === "nueva_compra"} onClose={() => { setModalActivo(null); setError(""); setCompraForm(emptyCompra); }} title={compraForm.id ? "Editar orden" : "Nueva orden de compra"} error={modalActivo === "nueva_compra" ? error : ""}>
              <form onSubmit={crearCompra}>
                <div className="form-field"><label>Proveedor</label>
                  <select value={compraForm.proveedor_id} onChange={e => setCompraForm({...compraForm, proveedor_id: e.target.value})}>
                    <option value="">Sin proveedor registrado</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Producto</label>
                  <select value={compraForm.cod_producto} onChange={e => { const prod = productos.find(x=>x.cod_producto===e.target.value); setCompraForm({...compraForm, cod_producto: e.target.value, descripcion: prod?.nombre || compraForm.descripcion}); }}>
                    <option value="">Selecciona producto</option>
                    {productos.map(p => <option key={p.cod_producto} value={p.cod_producto}>{p.cod_producto} - {p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Descripcion</label><input value={compraForm.descripcion} onChange={e => setCompraForm({...compraForm, descripcion: e.target.value})} placeholder="Descripcion" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Cantidad</label><input type="number" min="0" step="1" value={compraForm.cantidad} onChange={e => setCompraForm({...compraForm, cantidad: e.target.value})} placeholder="Cantidad" /></div>
                  <div className="form-field"><label>Costo unitario</label><input type="number" min="0" step="0.01" value={compraForm.costo_unitario} onChange={e => setCompraForm({...compraForm, costo_unitario: e.target.value})} placeholder="Q 0.00" /></div>
                </div>
                <div className="form-field"><label>Estado</label>
                  <select value={compraForm.estado} onChange={e => setCompraForm({...compraForm, estado: e.target.value})}>
                    <option value="borrador">Borrador</option>
                    <option value="orden_enviada">Orden enviada</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId || !compraForm.cod_producto}><Icon name="check" size={14} /> {compraForm.id ? "Guardar cambios" : "Crear orden"}</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>
            <Modal open={modalActivo === "nuevo_proveedor"} onClose={() => { setModalActivo(null); setError(""); setProveedorForm(emptyProveedor); }} title="Nuevo proveedor" error={modalActivo === "nuevo_proveedor" ? error : ""}>
              <form onSubmit={crearProveedor}>
                <div className="form-field"><label>Nombre</label><input value={proveedorForm.nombre} onChange={e => setProveedorForm({...proveedorForm, nombre: e.target.value})} placeholder="Nombre" /></div>
                <div className="form-field"><label>NIT</label><input value={proveedorForm.nit} onChange={e => setProveedorForm({...proveedorForm, nit: e.target.value})} placeholder="NIT" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Telefono</label><input value={proveedorForm.telefono} onChange={e => setProveedorForm({...proveedorForm, telefono: e.target.value})} placeholder="Telefono" /></div>
                  <div className="form-field"><label>Email</label><input value={proveedorForm.email} onChange={e => setProveedorForm({...proveedorForm, email: e.target.value})} placeholder="Email" /></div>
                </div>
                <div className="form-field"><label>Direccion</label><input value={proveedorForm.direccion} onChange={e => setProveedorForm({...proveedorForm, direccion: e.target.value})} placeholder="Direccion" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId}><Icon name="check" size={14} /> Crear proveedor</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div><h2>Compras</h2><p>Proveedores, ordenes de compra y recepcion de inventario.</p></div>
            </div>

            <div className="tabs">
              {[["ordenes","Ordenes de compra"],["proveedores","Proveedores"]].map(([id,label]) => (
                <button key={id} className={tabCompras === id ? "active" : ""} onClick={() => setTabCompras(id)}>{label}</button>
              ))}
            </div>

            {tabCompras === "ordenes" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar orden..." value={busquedaCompras} onChange={e => setBusquedaCompras(e.target.value)} /></div>
                  <span className="result-count">{comprasFiltradas.length} registros</span>
                  <button className="btn-primary" onClick={() => { setCompraForm(emptyCompra); setModalActivo("nueva_compra"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nueva orden</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Numero","Proveedor","Fecha","Estado","Total","Acciones"]} rows={comprasFiltradas}
                    renderRow={(c) => [c.numero, c.proveedor||"-", new Date(c.fecha).toLocaleDateString(),
                      <span key={c.id} className={`badge ${c.estado}`}>{c.estado}</span>,
                      `Q ${Number(c.total).toFixed(2)}`,
                      <div key={`${c.id}-ac`} className="inline-actions">
                        <button className="table-action" onClick={() => void abrirCompra(c.id).then(() => setModalActivo("nueva_compra"))}>Editar</button>
                        {c.estado !== "recibida" && c.estado !== "cancelada" && (
                          <button className="table-action" onClick={() => void recibirCompra(c.id)}>Recibir</button>
                        )}
                      </div>
                    ]}
                  />
                </div>
              </>
            )}

            {tabCompras === "proveedores" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar proveedor..." value={busquedaProveedores} onChange={e => setBusquedaProveedores(e.target.value)} /></div>
                  <span className="result-count">{proveedoresFiltrados.length} registros</span>
                  <button className="btn-primary" onClick={() => { setProveedorForm(emptyProveedor); setModalActivo("nuevo_proveedor"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nuevo proveedor</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Nombre","NIT","Telefono","Email","Estado"]} rows={proveedoresFiltrados}
                    renderRow={(p) => [p.nombre, p.nit||"-", p.telefono||"-", p.email||"-",
                      <span key={p.id} className={`badge ${p.estado}`}>{p.estado}</span>
                    ]}
                  />
                </div>
              </>
            )}
          </>
        )}


        {vistaActual === "facturas" && (
          <>
            <Modal open={modalActivo === "nueva_factura"} onClose={() => { setModalActivo(null); setError(""); setFacturaForm(emptyFactura); }} title={facturaForm.id ? "Editar factura" : "Nueva factura"} error={modalActivo === "nueva_factura" ? error : ""}>
              <form onSubmit={guardarFactura}>
                <div className="form-field"><label>Empresa</label>
                  <select value={facturaForm.empresa_id || empresaActivaId} onChange={e => setFacturaForm({...facturaForm, empresa_id: e.target.value})}>
                    {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Cliente</label>
                  <select value={facturaForm.cliente_id} onChange={e => setFacturaForm({...facturaForm, cliente_id: e.target.value})}>
                    <option value="">Consumidor final</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Producto</label>
                  <select value={facturaForm.cod_producto} onChange={e => { const p = productos.find(x=>x.cod_producto===e.target.value); setFacturaForm({...facturaForm, cod_producto: e.target.value, descripcion: p?.nombre||facturaForm.descripcion, precio_unitario: Number(p?.precio_venta||0)||facturaForm.precio_unitario}); }}>
                    <option value="">Selecciona producto</option>
                    {productos.map(p => <option key={p.cod_producto} value={p.cod_producto}>{p.cod_producto} - {p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Descripcion</label><input value={facturaForm.descripcion} onChange={e => setFacturaForm({...facturaForm, descripcion: e.target.value})} placeholder="Descripcion del item" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Cantidad</label><input type="number" min="0" step="0.01" value={facturaForm.cantidad} onChange={e => setFacturaForm({...facturaForm, cantidad: e.target.value})} /></div>
                  <div className="form-field"><label>Precio unitario</label><input type="number" min="0" step="0.01" value={facturaForm.precio_unitario} onChange={e => setFacturaForm({...facturaForm, precio_unitario: e.target.value})} /></div>
                </div>
                <div className="form-field"><label>Notas</label><input value={facturaForm.notas} onChange={e => setFacturaForm({...facturaForm, notas: e.target.value})} placeholder="Notas opcionales" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId || !facturaForm.cod_producto}><Icon name="check" size={14} /> {facturaForm.id ? "Guardar cambios" : "Crear borrador"}</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div><h2>Facturas</h2><p>Borrador, pendiente, publicado e impresion.</p></div>
              <div className="module-header__actions">
                <button className="btn-primary" onClick={() => { setFacturaForm(emptyFactura); setModalActivo("nueva_factura"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nueva factura</button>
              </div>
            </div>

            <div className="table-toolbar">
              <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar factura..." value={busquedaFacturas} onChange={e => setBusquedaFacturas(e.target.value)} /></div>
              <span className="result-count">{facturasFiltradas.length} registros</span>
            </div>
            <div className="panel">
              <DataTable columns={["Numero","Cliente","Estado","Total","Acciones"]} rows={facturasFiltradas}
                renderRow={(f) => [f.numero, f.cliente,
                  <span key={f.id} className={`badge ${f.estado}`}>{f.estado}</span>,
                  `Q ${Number(f.total).toFixed(2)}`,
                  <div key={`${f.id}-ac`} className="inline-actions">
                    <button className="table-action" onClick={() => void abrirFactura(f.id).then(() => setModalActivo("nueva_factura"))}>Editar</button>
                    {f.estado === "borrador" && <button className="table-action" onClick={() => void cambiarEstadoFactura(f.id, "confirmar")}>Confirmar</button>}
                    {f.estado === "pendiente" && <button className="table-action" onClick={() => void cambiarEstadoFactura(f.id, "validar")}>Validar</button>}
                    {f.estado !== "borrador" && <button className="table-action" onClick={() => void cambiarEstadoFactura(f.id, "restablecer-borrador")}>A borrador</button>}
                    <button className="table-action" onClick={() => void imprimirFactura(f.id)}>Imprimir</button>
                  </div>
                ]}
              />
            </div>
          </>
        )}

        {vistaActual === "inventario" && (
          <>
            <Modal open={modalActivo === "ajuste_inventario"} onClose={() => { setModalActivo(null); setError(""); setAjusteInventarioForm(emptyAjusteInventario); }} title="Ajustar stock" error={modalActivo === "ajuste_inventario" ? error : ""}>
              <form onSubmit={ajustarInventario}>
                <div className="form-field"><label>Producto</label>
                  <select value={ajusteInventarioForm.cod_producto} onChange={e => setAjusteInventarioForm({...ajusteInventarioForm, cod_producto: e.target.value})}>
                    <option value="">Selecciona producto</option>
                    {productos.map(p => <option key={p.cod_producto} value={p.cod_producto}>{p.cod_producto} - {p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Operacion</label>
                  <select value={ajusteInventarioForm.tipo_operacion} onChange={e => setAjusteInventarioForm({...ajusteInventarioForm, tipo_operacion: e.target.value})}>
                    <option value="aumentar">Aumentar stock</option>
                    <option value="disminuir">Disminuir stock</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>Cantidad</label><input type="number" min="1" step="1" value={ajusteInventarioForm.cantidad} onChange={e => setAjusteInventarioForm({...ajusteInventarioForm, cantidad: e.target.value})} placeholder="0" /></div>
                  <div className="form-field"><label>Referencia</label><input value={ajusteInventarioForm.referencia} onChange={e => setAjusteInventarioForm({...ajusteInventarioForm, referencia: e.target.value})} placeholder="Motivo del ajuste" /></div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId || !ajusteInventarioForm.cod_producto}><Icon name="check" size={14} /> Aplicar ajuste</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>
            <Modal open={modalActivo === "nuevo_producto"} onClose={() => { setModalActivo(null); setError(""); setProductoForm(emptyProducto); }} title="Nuevo producto" error={modalActivo === "nuevo_producto" ? error : ""}>
              <form onSubmit={crearProducto}>
                <div className="form-row">
                  <div className="form-field"><label>Codigo</label><input value={productoForm.cod_producto} onChange={e => setProductoForm({...productoForm, cod_producto: e.target.value})} placeholder="COD-001" /></div>
                  <div className="form-field"><label>Tipo</label>
                    <select value={productoForm.tipo} onChange={e => setProductoForm({...productoForm, tipo: e.target.value})}>
                      <option value="producto">Producto</option><option value="servicio">Servicio</option><option value="insumo">Insumo</option>
                    </select>
                  </div>
                </div>
                <div className="form-field"><label>Nombre</label><input value={productoForm.nombre} onChange={e => setProductoForm({...productoForm, nombre: e.target.value})} placeholder="Nombre del producto" /></div>
                <div className="form-field"><label>Categoria</label>
                  <select value={productoForm.categoria} onChange={e => setProductoForm({...productoForm, categoria: e.target.value})}>
                    <option value="">Sin categoria</option>
                    {categoriasProductos.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Descripcion</label><input value={productoForm.descripcion} onChange={e => setProductoForm({...productoForm, descripcion: e.target.value})} placeholder="Descripcion opcional" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Precio venta</label><input type="number" min="0" step="0.01" value={productoForm.precio_venta} onChange={e => setProductoForm({...productoForm, precio_venta: e.target.value})} placeholder="Q 0.00" /></div>
                  <div className="form-field"><label>Stock minimo</label><input type="number" min="0" step="1" value={productoForm.stock_minimo} onChange={e => setProductoForm({...productoForm, stock_minimo: e.target.value})} placeholder="0" /></div>
                </div>
                <div className="form-field"><label>Stock inicial</label><input type="number" min="0" step="1" value={productoForm.stock_inicial} onChange={e => setProductoForm({...productoForm, stock_inicial: e.target.value})} placeholder="0" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId}><Icon name="check" size={14} /> Crear producto</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>
            <Modal open={modalActivo === "nueva_categoria"} onClose={() => { setModalActivo(null); setError(""); setCategoriaForm(emptyCategoria); }} title="Nueva categoria" error={modalActivo === "nueva_categoria" ? error : ""}>
              <form onSubmit={crearCategoriaProducto}>
                <div className="form-field"><label>Nombre</label><input value={categoriaForm.nombre} onChange={e => setCategoriaForm({...categoriaForm, nombre: e.target.value})} placeholder="Nombre de la categoria" /></div>
                <div className="form-field"><label>Descripcion</label><input value={categoriaForm.descripcion} onChange={e => setCategoriaForm({...categoriaForm, descripcion: e.target.value})} placeholder="Descripcion opcional" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId}><Icon name="check" size={14} /> Crear categoria</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div><h2>Inventario</h2><p>Productos, categorias, stock, kardex y alertas.</p></div>
              <div className="module-header__actions">
                <button className="btn-secondary" onClick={() => void descargarReporte("inventario")}><Icon name="download" size={14} /> Exportar Excel</button>
              </div>
            </div>

            <div className="tabs">
              {[["stock","Stock actual"],["entradas","Entradas"],["salidas","Salidas"],["ajustes","Ajustes"],["kardex","Kardex"],["alertas","Alertas"],["productos","Productos"],["categorias","Categorias"]].map(([id,label]) => (
                <button key={id} className={tabInventario === id ? "active" : ""} onClick={() => setTabInventario(id)}>{label}</button>
              ))}
            </div>

            {tabInventario === "stock" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar producto..." value={busquedaInventario} onChange={e => setBusquedaInventario(e.target.value)} /></div>
                  <span className="result-count">{inventarioFiltrado.length} registros</span>
                </div>
                <div className="panel">
                  <DataTable columns={["Codigo","Producto","Categoria","Stock fisico","Stock reportado","Minimo","Estado"]} rows={inventarioFiltrado}
                    renderRow={(item) => [item.cod_producto, item.nombre, item.categoria||"-", item.stock_fisico, item.stock_reportado, item.stock_minimo,
                      <span key={item.id} className={`badge ${item.estado.toLowerCase()}`}>{item.estado}</span>
                    ]}
                  />
                </div>
              </>
            )}
            {tabInventario === "entradas" && (
              <div className="panel"><MovimientosInventarioTable movimientos={movimientosInventario.filter(m => Number(m.cantidad) > 0 || String(m.tipo_movimiento).includes("entrada"))} /></div>
            )}
            {tabInventario === "salidas" && (
              <div className="panel"><MovimientosInventarioTable movimientos={movimientosInventario.filter(m => Number(m.cantidad) < 0 || String(m.tipo_movimiento).includes("salida"))} /></div>
            )}
            {tabInventario === "ajustes" && (
              <>
                <div className="table-toolbar">
                  <span className="result-count">{inventario.length} productos en stock</span>
                  <button className="btn-primary" onClick={() => { setAjusteInventarioForm(emptyAjusteInventario); setModalActivo("ajuste_inventario"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nuevo ajuste</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Codigo","Producto","Stock fisico","Stock minimo","Estado"]} rows={inventario}
                    renderRow={(item) => [item.cod_producto, item.nombre, item.stock_fisico, item.stock_minimo,
                      <span key={item.id} className={`badge ${item.estado.toLowerCase()}`}>{item.estado}</span>
                    ]}
                  />
                </div>
              </>
            )}
            {tabInventario === "kardex" && (
              <>
                <div className="kardex-toolbar">
                  <select value={kardexProducto} onChange={e => { setKardexProducto(e.target.value); void cargarKardex(e.target.value); }}>
                    <option value="">Selecciona producto</option>
                    {productos.map(p => <option key={p.cod_producto} value={p.cod_producto}>{p.cod_producto} - {p.nombre}</option>)}
                  </select>
                  <button className="btn-secondary" onClick={() => void cargarKardex()} disabled={!kardexProducto}>Actualizar</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Fecha","Producto","Tipo","Referencia","Cantidad","Anterior","Nuevo"]} rows={kardex}
                    renderRow={(m) => [new Date(m.created_at).toLocaleString(), m.producto, m.tipo_movimiento, m.referencia||"-", m.cantidad, m.stock_anterior, m.stock_nuevo]}
                  />
                </div>
              </>
            )}
            {tabInventario === "alertas" && <AlertasPanel alertas={alertas} />}
            {tabInventario === "productos" && (
              <>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={14} /><input placeholder="Buscar producto..." value={busquedaProductos} onChange={e => setBusquedaProductos(e.target.value)} /></div>
                  <span className="result-count">{productosFiltrados.length} productos</span>
                  <button className="btn-primary" onClick={() => { setProductoForm(emptyProducto); setModalActivo("nuevo_producto"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nuevo producto</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Codigo","Nombre","Tipo","Categoria","Precio","Stock"]} rows={productosFiltrados}
                    renderRow={(p) => [p.cod_producto, p.nombre, p.tipo, p.categoria||"-", `Q ${Number(p.precio_venta).toFixed(2)}`, p.stock_fisico]}
                  />
                </div>
              </>
            )}
            {tabInventario === "categorias" && (
              <>
                <div className="table-toolbar">
                  <span className="result-count">{categoriasProductos.length} categorias</span>
                  <button className="btn-primary" onClick={() => { setCategoriaForm(emptyCategoria); setModalActivo("nueva_categoria"); }} disabled={!empresaActivaId}><Icon name="plus" size={14} /> Nueva categoria</button>
                </div>
                <div className="panel">
                  <DataTable columns={["Nombre","Descripcion","Empresa","Estado"]} rows={categoriasProductos}
                    renderRow={(cat) => [cat.nombre, cat.descripcion||"-", cat.empresa, <span key={cat.id} className={`badge ${cat.estado}`}>{cat.estado}</span>]}
                  />
                </div>
              </>
            )}
          </>
        )}

        {vistaActual === "empleados" && (
          <>
            <Modal open={modalActivo === "nuevo_empleado"} onClose={() => { setModalActivo(null); setError(""); setEmpleadoForm(emptyEmpleado); }} title="Nuevo empleado" error={modalActivo === "nuevo_empleado" ? error : ""}>
              <form onSubmit={crearEmpleado}>
                <div className="form-row">
                  <div className="form-field"><label>Codigo</label><input value={empleadoForm.codigo} onChange={e => setEmpleadoForm({...empleadoForm, codigo: e.target.value})} placeholder="Ej: EMP-001" /></div>
                  <div className="form-field"><label>DPI</label><input value={empleadoForm.dpi} onChange={e => setEmpleadoForm({...empleadoForm, dpi: e.target.value})} placeholder="DPI / Cedula" /></div>
                </div>
                <div className="form-field"><label>Nombre completo</label><input value={empleadoForm.nombre} onChange={e => setEmpleadoForm({...empleadoForm, nombre: e.target.value})} placeholder="Nombre completo" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Puesto</label><input value={empleadoForm.puesto} onChange={e => setEmpleadoForm({...empleadoForm, puesto: e.target.value})} placeholder="Puesto" /></div>
                  <div className="form-field"><label>Departamento</label><input value={empleadoForm.departamento} onChange={e => setEmpleadoForm({...empleadoForm, departamento: e.target.value})} placeholder="Departamento" /></div>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>Telefono</label><input value={empleadoForm.telefono} onChange={e => setEmpleadoForm({...empleadoForm, telefono: e.target.value})} placeholder="Telefono" /></div>
                  <div className="form-field"><label>Email</label><input type="email" value={empleadoForm.email} onChange={e => setEmpleadoForm({...empleadoForm, email: e.target.value})} placeholder="Email" /></div>
                </div>
                <div className="form-field"><label>Direccion</label><input value={empleadoForm.direccion} onChange={e => setEmpleadoForm({...empleadoForm, direccion: e.target.value})} placeholder="Direccion" /></div>
                <div className="form-row">
                  <div className="form-field"><label>Fecha de ingreso</label><input type="date" value={empleadoForm.fecha_ingreso} onChange={e => setEmpleadoForm({...empleadoForm, fecha_ingreso: e.target.value})} /></div>
                  <div className="form-field"><label>Salario base</label><input type="number" min="0" step="0.01" value={empleadoForm.salario_base} onChange={e => setEmpleadoForm({...empleadoForm, salario_base: e.target.value})} placeholder="Q 0.00" /></div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId}><Icon name="check" size={14} /> Crear empleado</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div>
                <h1><Icon name="empleados" size={22} /> Empleados</h1>
                <p>Registro de personal por empresa, puesto y departamento.</p>
              </div>
              <div className="module-header__actions">
                <button className="btn-primary" onClick={() => { setEmpleadoForm(emptyEmpleado); setModalActivo("nuevo_empleado"); }} disabled={!empresaActivaId}>
                  <Icon name="plus" size={14} /> Nuevo empleado
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="table-toolbar">
                <div className="search-box"><Icon name="search" size={14} /><input value={busquedaEmpleados} onChange={e => setBusquedaEmpleados(e.target.value)} placeholder="Buscar por nombre, codigo, puesto..." /></div>
                <span className="record-count">{empleadosFiltrados.length} empleados</span>
              </div>
              <table className="data-table">
                <thead><tr><th>Codigo</th><th>Nombre</th><th>Puesto</th><th>Departamento</th><th>Fecha ingreso</th><th>Salario</th><th>Estado</th></tr></thead>
                <tbody>
                  {empleadosFiltrados.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state">No se encontraron empleados.</td></tr>
                  ) : empleadosFiltrados.map(emp => (
                    <tr key={emp.id}>
                      <td><code>{emp.codigo}</code></td>
                      <td><strong>{emp.nombre}</strong></td>
                      <td>{emp.puesto || "-"}</td>
                      <td>{emp.departamento || "-"}</td>
                      <td>{emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString() : "-"}</td>
                      <td>Q {Number(emp.salario_base || 0).toFixed(2)}</td>
                      <td><span className={`badge ${emp.estado === "activo" ? "activo" : "inactivo"}`}>{emp.estado || "activo"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vistaActual === "vacaciones" && (
          <>
            <Modal open={modalActivo === "nueva_vacacion"} onClose={() => { setModalActivo(null); setError(""); setVacacionesForm(emptyVacaciones); }} title="Nueva solicitud de vacaciones" error={modalActivo === "nueva_vacacion" ? error : ""}>
              <form onSubmit={solicitarVacaciones}>
                <div className="form-field"><label>Empleado</label>
                  <select value={vacacionesForm.empleado_id} onChange={e => setVacacionesForm({...vacacionesForm, empleado_id: e.target.value})}>
                    <option value="">Selecciona empleado</option>
                    {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>Fecha inicio</label><input type="date" value={vacacionesForm.fecha_inicio} onChange={e => setVacacionesForm({...vacacionesForm, fecha_inicio: e.target.value})} /></div>
                  <div className="form-field"><label>Fecha fin</label><input type="date" value={vacacionesForm.fecha_fin} onChange={e => setVacacionesForm({...vacacionesForm, fecha_fin: e.target.value})} /></div>
                </div>
                <div className="form-field"><label>Motivo</label><input value={vacacionesForm.motivo} onChange={e => setVacacionesForm({...vacacionesForm, motivo: e.target.value})} placeholder="Descripcion del motivo" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary" disabled={!empresaActivaId || !vacacionesForm.empleado_id}><Icon name="check" size={14} /> Enviar solicitud</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div>
                <h1><Icon name="vacaciones" size={22} /> Vacaciones</h1>
                <p>Solicitudes de ausencia, aprobacion y rechazo por empleado.</p>
              </div>
              <div className="module-header__actions">
                <button className="btn-primary" onClick={() => { setVacacionesForm(emptyVacaciones); setModalActivo("nueva_vacacion"); }} disabled={!empresaActivaId}>
                  <Icon name="plus" size={14} /> Nueva solicitud
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="table-toolbar">
                <div className="search-box"><Icon name="search" size={14} /><input value={busquedaVacaciones} onChange={e => setBusquedaVacaciones(e.target.value)} placeholder="Buscar por empleado o estado..." /></div>
                <span className="record-count">{vacacionesFiltradas.length} solicitudes</span>
              </div>
              <table className="data-table">
                <thead><tr><th>Empleado</th><th>Fecha inicio</th><th>Fecha fin</th><th>Dias</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {vacacionesFiltradas.length === 0 ? (
                    <tr><td colSpan={6} className="empty-state">No se encontraron solicitudes.</td></tr>
                  ) : vacacionesFiltradas.map(sol => (
                    <tr key={sol.id}>
                      <td><strong>{sol.empleado}</strong></td>
                      <td>{new Date(sol.fecha_inicio).toLocaleDateString()}</td>
                      <td>{new Date(sol.fecha_fin).toLocaleDateString()}</td>
                      <td>{sol.dias_solicitados} dias</td>
                      <td>
                        <span className={`badge ${sol.estado === "aprobada" ? "aprobado" : sol.estado === "rechazada" ? "rechazado" : "pendiente"}`}>
                          {sol.estado}
                        </span>
                      </td>
                      <td>
                        {sol.estado === "pendiente" ? (
                          <div className="inline-actions">
                            <button className="btn-primary" style={{padding:"4px 10px",fontSize:"0.75rem"}} onClick={() => void resolverVacaciones(sol.id, "aprobar")}>Aprobar</button>
                            <button className="btn-danger" style={{padding:"4px 10px",fontSize:"0.75rem"}} onClick={() => void resolverVacaciones(sol.id, "rechazar")}>Rechazar</button>
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vistaActual === "reportes" && (
          <>
            <div className="module-header">
              <div>
                <h1><Icon name="reportes" size={22} /> Reportes</h1>
                <p>Reportes operativos y exportacion a Excel por modulo.</p>
              </div>
            </div>

            <div className="report-grid">
              {[
                { tipo: "ventas", label: "Ventas", desc: "Historial de ventas por fecha, canal y cliente.", icon: "ventas" },
                { tipo: "inventario", label: "Inventario", desc: "Stock actual, alertas y movimientos registrados.", icon: "inventario" },
                { tipo: "compras", label: "Compras", desc: "Ordenes de compra por proveedor y estado.", icon: "compras" },
                { tipo: "empleados", label: "Empleados", desc: "Nomina, puestos y datos de personal activo.", icon: "empleados" },
                { tipo: "vacaciones", label: "Vacaciones", desc: "Solicitudes aprobadas, rechazadas y pendientes.", icon: "vacaciones" },
              ].map(({ tipo, label, desc, icon }) => (
                <div key={tipo} className="report-card">
                  <div className="report-card__icon"><Icon name={icon} size={28} /></div>
                  <div className="report-card__info">
                    <h3>{label}</h3>
                    <p>{desc}</p>
                  </div>
                  <div className="report-card__actions">
                    <button className="btn-secondary" onClick={() => void cargarReporteOperativo(tipo)}>Ver reporte</button>
                    {(tipo === "ventas" || tipo === "inventario") && (
                      <button className="btn-ghost" onClick={() => void descargarReporte(tipo)}>
                        <Icon name="download" size={14} /> Excel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {reporteActual && (
              <div className="panel" style={{marginTop:"1.5rem"}}>
                <div className="table-toolbar">
                  <h2 style={{margin:0,fontWeight:600,fontSize:"1rem"}}>Reporte de {reporteActual.tipo}</h2>
                  <button className="btn-ghost" onClick={() => void descargarReporte(reporteActual.tipo)}>
                    <Icon name="download" size={14} /> Exportar Excel
                  </button>
                </div>
                <ReporteOperativoTable reporte={reporteActual} />
              </div>
            )}
          </>
        )}

        {vistaActual === "auditoria" && (
          <>
            <div className="module-header">
              <div>
                <h1><Icon name="auditoria" size={22} /> Auditoria</h1>
                <p>Registro de eventos del sistema para trazabilidad y control.</p>
              </div>
            </div>

            <div className="panel">
              <div className="table-toolbar">
                <span className="record-count">{eventosAuditoria.length} eventos</span>
              </div>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Empresa</th><th>Usuario</th><th>Modulo</th><th>Accion</th><th>Detalle</th></tr></thead>
                <tbody>
                  {eventosAuditoria.length === 0 ? (
                    <tr><td colSpan={6} className="empty-state">No hay eventos registrados.</td></tr>
                  ) : eventosAuditoria.map((evt, i) => (
                    <tr key={evt.id || i}>
                      <td style={{whiteSpace:"nowrap"}}>{new Date(evt.created_at).toLocaleString()}</td>
                      <td>{evt.empresa || "-"}</td>
                      <td>{evt.usuario || "-"}</td>
                      <td><span className="badge">{evt.modulo || "-"}</span></td>
                      <td><strong>{evt.accion}</strong></td>
                      <td style={{maxWidth:"260px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={evt.detalle}>{evt.detalle || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vistaActual === "ajustes" && puedeAdministrar && (
          <>
            <Modal open={modalActivo === "nueva_empresa"} onClose={() => { setModalActivo(null); setError(""); setEmpresaForm(emptyEmpresa); }} title="Nueva empresa" error={modalActivo === "nueva_empresa" ? error : ""}>
              <form onSubmit={crearEmpresa}>
                <div className="form-row">
                  <div className="form-field"><label>Nombre</label><input value={empresaForm.nombre} onChange={e => setEmpresaForm({...empresaForm, nombre: e.target.value})} placeholder="Nombre de la empresa" /></div>
                  <div className="form-field"><label>NIT</label><input value={empresaForm.nit} onChange={e => setEmpresaForm({...empresaForm, nit: e.target.value})} placeholder="NIT" /></div>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>Telefono</label><input value={empresaForm.telefono} onChange={e => setEmpresaForm({...empresaForm, telefono: e.target.value})} placeholder="Telefono" /></div>
                  <div className="form-field"><label>Email</label><input type="email" value={empresaForm.email} onChange={e => setEmpresaForm({...empresaForm, email: e.target.value})} placeholder="Email" /></div>
                </div>
                <div className="form-field"><label>Direccion</label><input value={empresaForm.direccion} onChange={e => setEmpresaForm({...empresaForm, direccion: e.target.value})} placeholder="Direccion" /></div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary"><Icon name="check" size={14} /> Crear empresa</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <Modal open={modalActivo === "nuevo_usuario"} onClose={() => { setModalActivo(null); setError(""); setUsuarioForm(emptyUsuario); }} title="Nuevo usuario" error={modalActivo === "nuevo_usuario" ? error : ""}>
              <form onSubmit={crearUsuario}>
                <div className="form-row">
                  <div className="form-field"><label>Nombre</label><input value={usuarioForm.nombre} onChange={e => setUsuarioForm({...usuarioForm, nombre: e.target.value})} placeholder="Nombre completo" /></div>
                  <div className="form-field"><label>Email</label><input type="email" value={usuarioForm.email} onChange={e => setUsuarioForm({...usuarioForm, email: e.target.value})} placeholder="Email" /></div>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>Contrasena</label><input type="password" value={usuarioForm.password} onChange={e => setUsuarioForm({...usuarioForm, password: e.target.value})} placeholder="Contrasena temporal" /></div>
                  <div className="form-field"><label>Rol</label>
                    <select value={usuarioForm.rol} onChange={e => setUsuarioForm({...usuarioForm, rol: e.target.value})}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-field"><label>Empresas asignadas</label>
                  <div className="checkbox-list">
                    {empresas.map(emp => (
                      <label key={emp.id}>
                        <input type="checkbox" checked={usuarioForm.empresas.includes(emp.id)} onChange={() => {
                          const next = usuarioForm.empresas.includes(emp.id)
                            ? usuarioForm.empresas.filter(id => id !== emp.id)
                            : [...usuarioForm.empresas, emp.id];
                          setUsuarioForm({...usuarioForm, empresas: next});
                        }} />
                        {emp.nombre}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary"><Icon name="check" size={14} /> Crear usuario</button>
                  <button type="button" className="btn-secondary" onClick={() => setModalActivo(null)}>Cancelar</button>
                </div>
              </form>
            </Modal>

            <div className="module-header">
              <div>
                <h1><Icon name="ajustes" size={22} /> Ajustes</h1>
                <p>Configuracion de empresas, usuarios y permisos del sistema.</p>
              </div>
            </div>

            <div className="tabs" style={{marginBottom:"1.5rem"}}>
              {[["empresas","Empresas"],["usuarios","Usuarios"],["roles","Roles"]].map(([id, label]) => (
                <button key={id} className={tabAjustes === id ? "active" : ""} onClick={() => setTabAjustes(id)}>{label}</button>
              ))}
            </div>

            {tabAjustes === "empresas" && (
              <div className="panel">
                <div className="table-toolbar">
                  <span className="record-count">{empresas.length} empresas</span>
                  <button className="btn-primary" onClick={() => { setEmpresaForm(emptyEmpresa); setModalActivo("nueva_empresa"); }}>
                    <Icon name="plus" size={14} /> Nueva empresa
                  </button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Nombre</th><th>NIT</th><th>Telefono</th><th>Email</th><th>Estado</th><th>Accion</th></tr></thead>
                  <tbody>
                    {empresas.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state">No hay empresas registradas.</td></tr>
                    ) : empresas.map(emp => (
                      <tr key={emp.id}>
                        <td><strong>{emp.nombre}</strong></td>
                        <td>{emp.nit || "-"}</td>
                        <td>{emp.telefono || "-"}</td>
                        <td>{emp.email || "-"}</td>
                        <td><span className={`badge ${emp.estado === "activa" ? "activo" : "inactivo"}`}>{emp.estado}</span></td>
                        <td>
                          <button className={emp.estado === "activa" ? "btn-danger" : "btn-secondary"} style={{padding:"4px 10px",fontSize:"0.75rem"}} onClick={() => void cambiarEstadoEmpresa(emp)}>
                            {emp.estado === "activa" ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tabAjustes === "usuarios" && (
              <div className="panel">
                <div className="table-toolbar">
                  <span className="record-count">{usuarios.length} usuarios</span>
                  <button className="btn-primary" onClick={() => { setUsuarioForm(emptyUsuario); setModalActivo("nuevo_usuario"); }}>
                    <Icon name="plus" size={14} /> Nuevo usuario
                  </button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Empresas</th><th>Estado</th><th>Accion</th></tr></thead>
                  <tbody>
                    {usuarios.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state">No hay usuarios registrados.</td></tr>
                    ) : usuarios.map(usr => (
                      <tr key={usr.id}>
                        <td><strong>{usr.nombre}</strong></td>
                        <td>{usr.email}</td>
                        <td><span className="badge">{usr.rol}</span></td>
                        <td>{usr.empresas?.map(e => e.empresa).join(", ") || "-"}</td>
                        <td><span className={`badge ${usr.activo ? "activo" : "inactivo"}`}>{usr.activo ? "Activo" : "Inactivo"}</span></td>
                        <td>
                          <button className={usr.activo ? "btn-danger" : "btn-secondary"} style={{padding:"4px 10px",fontSize:"0.75rem"}} onClick={() => void cambiarEstadoUsuario(usr)}>
                            {usr.activo ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tabAjustes === "roles" && (
              <div className="role-grid">
                {ROLES.map(rol => (
                  <article key={rol} className="role-card">
                    <div className="role-card__icon"><Icon name="empleados" size={22} /></div>
                    <strong>{rol}</strong>
                    <span>{rol === "admin" ? "Administra empresas, usuarios y permisos del sistema." : "Acceso operativo a modulos segun empresas asignadas."}</span>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}

function DocumentoVentaForm({
  title,
  form,
  setForm,
  clientes,
  empresaActivaId,
  onSubmit,
  showOrdenDespacho = false,
}) {
  const subtotal = Number(form.cantidad || 0) * Number(form.precio_unitario || 0);
  const impuestos = subtotal * (Number(form.impuesto_porcentaje || 0) / 100);

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <select
        value={form.cliente_id}
        onChange={(event) => setForm({ ...form, cliente_id: event.target.value })}
      >
        <option value="">Cliente no registrado</option>
        {clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.nombre}
          </option>
        ))}
      </select>

      <input
        value={form.descripcion}
        onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
        placeholder="Producto o servicio"
      />

      <div className="form-row">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.cantidad}
          onChange={(event) => setForm({ ...form, cantidad: event.target.value })}
          placeholder="Cantidad"
        />
        <input
          value={form.unidad}
          onChange={(event) => setForm({ ...form, unidad: event.target.value })}
          placeholder="Unidad"
        />
      </div>

      <div className="form-row">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.precio_unitario}
          onChange={(event) =>
            setForm({ ...form, precio_unitario: event.target.value })
          }
          placeholder="Precio unitario"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.impuesto_porcentaje}
          onChange={(event) =>
            setForm({ ...form, impuesto_porcentaje: event.target.value })
          }
          placeholder="IVA %"
        />
      </div>

      {!showOrdenDespacho && (
        <input
          type="date"
          value={form.fecha_vencimiento}
          onChange={(event) =>
            setForm({ ...form, fecha_vencimiento: event.target.value })
          }
        />
      )}

      {showOrdenDespacho && (
        <input
          value={form.orden_despacho}
          onChange={(event) =>
            setForm({ ...form, orden_despacho: event.target.value })
          }
          placeholder="Orden de despacho"
        />
      )}

      <div className="document-total">
        <span>Subtotal: Q {subtotal.toFixed(2)}</span>
        <strong>Total: Q {(subtotal + impuestos).toFixed(2)}</strong>
      </div>

      <button type="submit" disabled={!empresaActivaId}>
        Guardar
      </button>
    </form>
  );
}

function calcularTotalCarrito(carrito, descuento) {
  const subtotal = carrito.reduce(
    (total, item) =>
      total + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
    0
  );
  const descuentoAplicado = Math.min(Number(descuento || 0), subtotal);
  const base = Math.max(subtotal - descuentoAplicado, 0);

  return base + base * 0.12;
}

function MovimientosInventarioTable({ movimientos }) {
  return (
    <DataTable
      columns={["Fecha", "Producto", "Tipo", "Referencia", "Cantidad", "Anterior", "Nuevo"]}
      rows={movimientos}
      renderRow={(movimiento) => [
        new Date(movimiento.created_at).toLocaleString(),
        movimiento.producto,
        movimiento.tipo_movimiento,
        movimiento.referencia || "-",
        movimiento.cantidad,
        movimiento.stock_anterior,
        movimiento.stock_nuevo,
      ]}
    />
  );
}

function ReporteOperativoTable({ reporte }) {
  const rows =
    reporte.data.ventas ||
    reporte.data.inventario ||
    reporte.data.compras ||
    reporte.data.empleados ||
    reporte.data.vacaciones ||
    [];
  const firstRow = rows[0];

  if (!firstRow) {
    return <p className="empty-state">No hay datos para mostrar.</p>;
  }

  const columns = Object.keys(firstRow).slice(0, 8);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      renderRow={(row) =>
        columns.map((column) => {
          const value = row[column];

          if (typeof value === "number") {
            return Number(value).toFixed(2);
          }

          return value || "-";
        })
      }
    />
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

function AnalisisVisual({ dashboard, inventario, alertas }) {
  const ventasPorCanal = (dashboard?.comparativa_canales ?? []).map((item) => ({
    canal: item.canal || "Sin canal",
    total: Number(item.total),
  }));

  const topProductos = (dashboard?.top_productos ?? []).map((item) => ({
    producto: item.cod_producto,
    total_vendido: Number(item.total_vendido),
  }));

  const ventasPorFecha = (dashboard?.ventas_por_fecha ?? []).map((item) => ({
    fecha: new Date(item.fecha).toLocaleDateString("es-GT", {
      month: "short",
      day: "numeric",
    }),
    total: Number(item.total),
  }));

  const stockComparativo = (inventario ?? []).slice(0, 10).map((item) => ({
    producto: item.nombre || item.cod_producto,
    stock_fisico: Number(item.stock_fisico),
    stock_reportado: Number(item.stock_reportado),
  }));

  const noData = <p className="chart-no-data">No hay datos disponibles para graficar</p>;

  return (
    <section className="analisis-visual">
      <h2 className="analisis-title">Analisis visual</h2>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Ventas por canal</h3>
          {ventasPorCanal.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ventasPorCanal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="canal" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Q${v.toFixed(0)}`} />
                <Tooltip formatter={(v) => [`Q ${Number(v).toFixed(2)}`, "Total"]} />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h3>Top productos</h3>
          {topProductos.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProductos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="producto" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, "Unidades vendidas"]} />
                <Bar dataKey="total_vendido" fill="#10b981" radius={[4, 4, 0, 0]} name="Unidades" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card chart-card--wide">
          <h3>Ventas por fecha</h3>
          {ventasPorFecha.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ventasPorFecha} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Q${v.toFixed(0)}`} />
                <Tooltip formatter={(v) => [`Q ${Number(v).toFixed(2)}`, "Total"]} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card chart-card--wide">
          <h3>Stock fisico vs stock reportado</h3>
          {stockComparativo.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stockComparativo} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="producto" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock_fisico" fill="#6366f1" radius={[4, 4, 0, 0]} name="Stock fisico" />
                <Bar dataKey="stock_reportado" fill="#10b981" radius={[4, 4, 0, 0]} name="Stock reportado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="chart-card">
        <h3>Inventario critico</h3>
        {alertas.length === 0 ? noData : (
          <div className="inventario-critico-grid">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`critico-card critico-card--${alerta.severidad.toLowerCase()}`}
              >
                <div className="critico-card__header">
                  <span className="critico-card__nombre">
                    {alerta.nombre || alerta.cod_producto}
                  </span>
                  <span className={`badge ${alerta.severidad.toLowerCase()}`}>
                    {alerta.severidad}
                  </span>
                </div>
                <div className="critico-card__stats">
                  <div>
                    <span className="critico-label">Stock actual</span>
                    <strong>{alerta.stock_actual}</strong>
                  </div>
                  <div>
                    <span className="critico-label">Stock minimo</span>
                    <strong>{alerta.stock_minimo}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
