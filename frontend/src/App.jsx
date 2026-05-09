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
          {[
            "dashboard",
            "ventas",
            "pos",
            "compras",
            "facturas",
            "inventario",
            "empleados",
            "vacaciones",
            "reportes",
            "auditoria",
          ].map(
            (vista) => (
              <button
                key={vista}
                className={`menu-link ${vistaActual === vista ? "active" : ""}`}
                onClick={() => setVistaActual(vista)}
              >
                {vista === "dashboard"
                  ? "Dashboard"
                  : vista === "pos"
                    ? "Punto de venta"
                    : vista === "compras"
                      ? "Compras"
                      : vista === "facturas"
                        ? "Facturas"
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
                <span>Ventas del mes</span>
                <strong>Q {Number(dashboard.ventas_mes || 0).toFixed(2)}</strong>
                <small>Mes del rango actual</small>
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
                <span>Compras del mes</span>
                <strong>Q {Number(dashboard.compras_mes || 0).toFixed(2)}</strong>
                <small>Ordenes recibidas o registradas</small>
              </article>

              <article className="metric-card">
                <span>Ordenes pendientes</span>
                <strong>{dashboard.ordenes_pendientes || 0}</strong>
                <small>Ordenes de venta activas</small>
              </article>

              <article className="metric-card">
                <span>Cotizaciones pendientes</span>
                <strong>{dashboard.cotizaciones_pendientes || 0}</strong>
                <small>Cotizaciones por confirmar</small>
              </article>

              <article className="metric-card">
                <span>Empleados activos</span>
                <strong>{dashboard.empleados_activos || 0}</strong>
                <small>Personal registrado activo</small>
              </article>

              <article className="metric-card">
                <span>Vacaciones pendientes</span>
                <strong>{dashboard.vacaciones_pendientes || 0}</strong>
                <small>Solicitudes por aprobar</small>
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

            <section className="panel">
              <h2>Ultimos movimientos de inventario</h2>
              <DataTable
                columns={["Fecha", "Producto", "Tipo", "Cantidad", "Stock"]}
                rows={dashboard.ultimos_movimientos || []}
                renderRow={(movimiento) => [
                  new Date(movimiento.created_at).toLocaleString(),
                  movimiento.producto,
                  movimiento.tipo_movimiento,
                  movimiento.cantidad,
                  movimiento.stock_nuevo,
                ]}
              />
            </section>

            <AlertasPanel alertas={alertas} />
          </>
        )}

        {vistaActual === "ventas" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Modulo de ventas</h2>
                <p>Cotizaciones, ordenes de venta y clientes.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void descargarReporte("ventas")}
              >
                Descargar Excel
              </button>
            </div>

            <div className="tabs">
              {["cotizaciones", "ordenes", "clientes", "historico"].map((tab) => (
                <button
                  key={tab}
                  className={tabVentas === tab ? "active" : ""}
                  onClick={() => setTabVentas(tab)}
                >
                  {tab === "ordenes" ? "Ordenes de venta" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {tabVentas === "cotizaciones" && (
              <div className="settings-grid">
                <DocumentoVentaForm
                  title="Nueva cotizacion"
                  form={cotizacionForm}
                  setForm={setCotizacionForm}
                  clientes={clientes}
                  empresaActivaId={empresaActivaId}
                  onSubmit={crearCotizacion}
                />

                <div>
                  <h2>Cotizaciones</h2>
                  <DataTable
                    columns={["Numero", "Cliente", "Fecha", "Estado", "Total", "Accion"]}
                    rows={cotizaciones}
                    renderRow={(cotizacion) => [
                      cotizacion.numero,
                      cotizacion.cliente,
                      new Date(cotizacion.fecha_creacion).toLocaleDateString(),
                      <span
                        key={cotizacion.id}
                        className={`badge ${String(cotizacion.estado).replace("_", "-")}`}
                      >
                        {cotizacion.estado}
                      </span>,
                      `Q ${Number(cotizacion.total).toFixed(2)}`,
                      cotizacion.estado === "orden_venta" ? (
                        "Confirmada"
                      ) : (
                        <button
                          key={`${cotizacion.id}-confirmar`}
                          className="table-action"
                          onClick={() => void confirmarCotizacion(cotizacion.id)}
                        >
                          Confirmar
                        </button>
                      ),
                    ]}
                  />
                </div>
              </div>
            )}

            {tabVentas === "ordenes" && (
              <div className="settings-grid">
                <DocumentoVentaForm
                  title="Nueva orden de venta"
                  form={ordenForm}
                  setForm={setOrdenForm}
                  clientes={clientes}
                  empresaActivaId={empresaActivaId}
                  onSubmit={crearOrdenVenta}
                  showOrdenDespacho
                />

                <div>
                  <h2>Ordenes de venta</h2>
                  <DataTable
                    columns={["Numero", "Cliente", "Fecha", "Estado", "Total", "Accion"]}
                    rows={ordenesVenta}
                    renderRow={(orden) => [
                      orden.numero,
                      orden.cliente,
                      new Date(orden.fecha_orden).toLocaleDateString(),
                      <span key={orden.id} className={`badge ${orden.estado}`}>
                        {orden.estado}
                      </span>,
                      `Q ${Number(orden.total).toFixed(2)}`,
                      orden.estado === "cancelado" ? (
                        "Cancelada"
                      ) : (
                        <button
                          key={`${orden.id}-cancelar`}
                          className="table-action"
                          onClick={() => void cancelarOrdenVenta(orden.id)}
                        >
                          Cancelar
                        </button>
                      ),
                    ]}
                  />
                </div>
              </div>
            )}

            {tabVentas === "clientes" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearCliente}>
                  <h2>Nuevo cliente</h2>
                  <input
                    value={clienteForm.nombre}
                    onChange={(event) =>
                      setClienteForm({ ...clienteForm, nombre: event.target.value })
                    }
                    placeholder="Nombre"
                  />
                  <input
                    value={clienteForm.nit}
                    onChange={(event) =>
                      setClienteForm({ ...clienteForm, nit: event.target.value })
                    }
                    placeholder="NIT"
                  />
                  <input
                    value={clienteForm.telefono}
                    onChange={(event) =>
                      setClienteForm({ ...clienteForm, telefono: event.target.value })
                    }
                    placeholder="Telefono"
                  />
                  <input
                    value={clienteForm.email}
                    onChange={(event) =>
                      setClienteForm({ ...clienteForm, email: event.target.value })
                    }
                    placeholder="Email"
                  />
                  <input
                    value={clienteForm.direccion}
                    onChange={(event) =>
                      setClienteForm({ ...clienteForm, direccion: event.target.value })
                    }
                    placeholder="Direccion"
                  />
                  <button type="submit" disabled={!empresaActivaId}>
                    Crear cliente
                  </button>
                </form>

                <div>
                  <h2>Clientes</h2>
                  <DataTable
                    columns={["Nombre", "NIT", "Telefono", "Email", "Empresa", "Estado"]}
                    rows={clientes}
                    renderRow={(cliente) => [
                      cliente.nombre,
                      cliente.nit || "-",
                      cliente.telefono || "-",
                      cliente.email || "-",
                      cliente.empresa,
                      cliente.estado,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabVentas === "historico" && (
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
            )}
          </section>
        )}

        {vistaActual === "pos" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Punto de venta</h2>
                <p>Venta rapida con carrito, pagos y corte de caja.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void buscarProductosPos()}
                disabled={!empresaActivaId}
              >
                Buscar productos
              </button>
            </div>

            <div className="pos-grid">
              <section className="pos-products">
                <div className="pos-search">
                  <input
                    value={busquedaPos}
                    onChange={(event) => setBusquedaPos(event.target.value)}
                    placeholder="Buscar por codigo o nombre"
                  />
                  <button onClick={() => void buscarProductosPos()}>
                    Buscar
                  </button>
                </div>

                <DataTable
                  columns={["Producto", "Codigo", "Stock", "Precio", "Accion"]}
                  rows={productosPos}
                  renderRow={(producto) => [
                    producto.nombre,
                    producto.cod_producto,
                    producto.stock_fisico,
                    `Q ${Number(producto.precio_unitario).toFixed(2)}`,
                    <button
                      key={`${producto.cod_producto}-add`}
                      className="table-action"
                      onClick={() => agregarProductoPos(producto)}
                    >
                      Agregar
                    </button>,
                  ]}
                />
              </section>

              <section className="pos-cart">
                <h2>Carrito</h2>
                <DataTable
                  columns={["Producto", "Cant.", "Precio", "Subtotal"]}
                  rows={carritoPos}
                  renderRow={(item) => [
                    item.descripcion,
                    <input
                      key={`${item.cod_producto}-cantidad`}
                      type="number"
                      min="0"
                      step="1"
                      value={item.cantidad}
                      onChange={(event) =>
                        actualizarCantidadPos(item.cod_producto, event.target.value)
                      }
                    />,
                    `Q ${Number(item.precio_unitario).toFixed(2)}`,
                    `Q ${(Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2)}`,
                  ]}
                />

                <div className="pos-summary">
                  <label>
                    Descuento
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={descuentoPos}
                      onChange={(event) => setDescuentoPos(event.target.value)}
                    />
                  </label>
                  <label>
                    Metodo de pago
                    <select
                      value={metodoPagoPos}
                      onChange={(event) => setMetodoPagoPos(event.target.value)}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="mixto">Mixto</option>
                    </select>
                  </label>
                  <strong>Total: Q {calcularTotalCarrito(carritoPos, descuentoPos).toFixed(2)}</strong>
                  <button
                    onClick={() => void finalizarVentaPos()}
                    disabled={!empresaActivaId || carritoPos.length === 0}
                  >
                    Finalizar venta
                  </button>
                </div>
              </section>
            </div>

            <section className="main-grid pos-history">
              <article className="panel embedded-panel">
                <div className="panel-header">
                  <div>
                    <h2>Corte de caja</h2>
                    <p>Apertura y cierre del dia actual.</p>
                  </div>
                </div>
                <div className="cash-actions">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoInicialCaja}
                    onChange={(event) => setMontoInicialCaja(event.target.value)}
                    placeholder="Monto inicial"
                  />
                  <button onClick={() => void abrirCorteCaja()} disabled={!empresaActivaId}>
                    Abrir
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void cerrarCorteCaja()}
                    disabled={!empresaActivaId}
                  >
                    Cerrar
                  </button>
                </div>

                <DataTable
                  columns={["Empresa", "Inicial", "Ventas", "Estado"]}
                  rows={cortesCaja}
                  renderRow={(corte) => [
                    corte.empresa,
                    `Q ${Number(corte.monto_inicial).toFixed(2)}`,
                    `Q ${Number(corte.total_ventas).toFixed(2)}`,
                    corte.estado,
                  ]}
                />
              </article>

              <article className="panel embedded-panel">
                <h2>Ventas del dia</h2>
                <DataTable
                  columns={["Hora", "Metodo", "Descuento", "Total"]}
                  rows={ventasPosDia}
                  renderRow={(venta) => [
                    new Date(venta.fecha).toLocaleTimeString(),
                    venta.metodo_pago,
                    `Q ${Number(venta.descuento).toFixed(2)}`,
                    `Q ${Number(venta.total).toFixed(2)}`,
                  ]}
                />
              </article>
            </section>
          </section>
        )}

        {vistaActual === "compras" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Compras</h2>
                <p>Proveedores, ordenes de compra y recepcion de inventario.</p>
              </div>
            </div>

            <div className="tabs">
              {["ordenes", "proveedores"].map((tab) => (
                <button
                  key={tab}
                  className={tabCompras === tab ? "active" : ""}
                  onClick={() => setTabCompras(tab)}
                >
                  {tab === "ordenes" ? "Ordenes de compra" : "Proveedores"}
                </button>
              ))}
            </div>

            {tabCompras === "ordenes" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearCompra}>
                  <h2>Nueva orden de compra</h2>
                  <select
                    value={compraForm.proveedor_id}
                    onChange={(event) =>
                      setCompraForm({
                        ...compraForm,
                        proveedor_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Proveedor no registrado</option>
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={compraForm.cod_producto}
                    onChange={(event) => {
                      const producto = productos.find(
                        (item) => item.cod_producto === event.target.value
                      );
                      setCompraForm({
                        ...compraForm,
                        cod_producto: event.target.value,
                        descripcion: producto?.nombre || compraForm.descripcion,
                      });
                    }}
                  >
                    <option value="">Selecciona producto</option>
                    {productos.map((producto) => (
                      <option key={producto.cod_producto} value={producto.cod_producto}>
                        {producto.cod_producto} - {producto.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={compraForm.descripcion}
                    onChange={(event) =>
                      setCompraForm({
                        ...compraForm,
                        descripcion: event.target.value,
                      })
                    }
                    placeholder="Descripcion"
                  />
                  <div className="form-row">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={compraForm.cantidad}
                      onChange={(event) =>
                        setCompraForm({
                          ...compraForm,
                          cantidad: event.target.value,
                        })
                      }
                      placeholder="Cantidad"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={compraForm.costo_unitario}
                      onChange={(event) =>
                        setCompraForm({
                          ...compraForm,
                          costo_unitario: event.target.value,
                        })
                      }
                      placeholder="Costo unitario"
                    />
                  </div>
                  <select
                    value={compraForm.estado}
                    onChange={(event) =>
                      setCompraForm({ ...compraForm, estado: event.target.value })
                    }
                  >
                    <option value="borrador">Borrador</option>
                    <option value="orden_enviada">Orden enviada</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!empresaActivaId || !compraForm.cod_producto}
                  >
                    {compraForm.id ? "Guardar orden" : "Crear orden"}
                  </button>
                  {compraForm.id && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setCompraForm(emptyCompra)}
                    >
                      Nueva orden
                    </button>
                  )}
                </form>

                <div>
                  <h2>Ordenes de compra</h2>
                  <DataTable
                    columns={["Numero", "Proveedor", "Fecha", "Estado", "Total", "Accion"]}
                    rows={compras}
                    renderRow={(compra) => [
                      compra.numero,
                      compra.proveedor,
                      new Date(compra.fecha).toLocaleDateString(),
                      <span key={compra.id} className={`badge ${compra.estado}`}>
                        {compra.estado}
                      </span>,
                      `Q ${Number(compra.total).toFixed(2)}`,
                      <div key={`${compra.id}-acciones`} className="inline-actions">
                        <button
                          className="table-action"
                          onClick={() => void abrirCompra(compra.id)}
                        >
                          Abrir
                        </button>
                        {compra.estado !== "recibida" && compra.estado !== "cancelada" && (
                          <button
                            className="table-action"
                            onClick={() => void recibirCompra(compra.id)}
                          >
                            Recibir
                          </button>
                        )}
                      </div>,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabCompras === "proveedores" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearProveedor}>
                  <h2>Nuevo proveedor</h2>
                  <input
                    value={proveedorForm.nombre}
                    onChange={(event) =>
                      setProveedorForm({
                        ...proveedorForm,
                        nombre: event.target.value,
                      })
                    }
                    placeholder="Nombre"
                  />
                  <input
                    value={proveedorForm.nit}
                    onChange={(event) =>
                      setProveedorForm({ ...proveedorForm, nit: event.target.value })
                    }
                    placeholder="NIT"
                  />
                  <input
                    value={proveedorForm.telefono}
                    onChange={(event) =>
                      setProveedorForm({
                        ...proveedorForm,
                        telefono: event.target.value,
                      })
                    }
                    placeholder="Telefono"
                  />
                  <input
                    value={proveedorForm.email}
                    onChange={(event) =>
                      setProveedorForm({ ...proveedorForm, email: event.target.value })
                    }
                    placeholder="Email"
                  />
                  <input
                    value={proveedorForm.direccion}
                    onChange={(event) =>
                      setProveedorForm({
                        ...proveedorForm,
                        direccion: event.target.value,
                      })
                    }
                    placeholder="Direccion"
                  />
                  <button type="submit" disabled={!empresaActivaId}>
                    Crear proveedor
                  </button>
                </form>

                <div>
                  <h2>Proveedores</h2>
                  <DataTable
                    columns={["Nombre", "NIT", "Telefono", "Email", "Estado"]}
                    rows={proveedores}
                    renderRow={(proveedor) => [
                      proveedor.nombre,
                      proveedor.nit || "-",
                      proveedor.telefono || "-",
                      proveedor.email || "-",
                      proveedor.estado,
                    ]}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {vistaActual === "facturas" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Facturas</h2>
                <p>Borrador, pendiente, publicado e impresion de factura.</p>
              </div>
            </div>

            <div className="settings-grid">
              <form className="admin-form" onSubmit={guardarFactura}>
                <h2>{facturaForm.id ? "Editar factura" : "Nueva factura"}</h2>
                <select
                  value={facturaForm.empresa_id || empresaActivaId}
                  onChange={(event) =>
                    setFacturaForm({ ...facturaForm, empresa_id: event.target.value })
                  }
                >
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={facturaForm.cliente_id}
                  onChange={(event) =>
                    setFacturaForm({ ...facturaForm, cliente_id: event.target.value })
                  }
                >
                  <option value="">Consumidor final</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={facturaForm.cod_producto}
                  onChange={(event) => {
                    const producto = productos.find(
                      (item) => item.cod_producto === event.target.value
                    );
                    setFacturaForm({
                      ...facturaForm,
                      cod_producto: event.target.value,
                      descripcion: producto?.nombre || facturaForm.descripcion,
                      precio_unitario:
                        Number(producto?.precio_venta || 0) ||
                        facturaForm.precio_unitario,
                    });
                  }}
                >
                  <option value="">Selecciona producto</option>
                  {productos.map((producto) => (
                    <option key={producto.cod_producto} value={producto.cod_producto}>
                      {producto.cod_producto} - {producto.nombre}
                    </option>
                  ))}
                </select>
                <input
                  value={facturaForm.descripcion}
                  onChange={(event) =>
                    setFacturaForm({ ...facturaForm, descripcion: event.target.value })
                  }
                  placeholder="Descripcion"
                />
                <div className="form-row">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={facturaForm.cantidad}
                    onChange={(event) =>
                      setFacturaForm({ ...facturaForm, cantidad: event.target.value })
                    }
                    placeholder="Cantidad"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={facturaForm.precio_unitario}
                    onChange={(event) =>
                      setFacturaForm({
                        ...facturaForm,
                        precio_unitario: event.target.value,
                      })
                    }
                    placeholder="Precio"
                  />
                </div>
                <input
                  value={facturaForm.notas}
                  onChange={(event) =>
                    setFacturaForm({ ...facturaForm, notas: event.target.value })
                  }
                  placeholder="Notas"
                />
                <button type="submit" disabled={!empresaActivaId || !facturaForm.cod_producto}>
                  {facturaForm.id ? "Guardar cambios" : "Crear borrador"}
                </button>
                {facturaForm.id && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setFacturaForm(emptyFactura)}
                  >
                    Nueva factura
                  </button>
                )}
              </form>

              <div>
                <h2>Facturas creadas</h2>
                <DataTable
                  columns={["Numero", "Cliente", "Estado", "Total", "Acciones"]}
                  rows={facturas}
                  renderRow={(factura) => [
                    factura.numero,
                    factura.cliente,
                    <span key={factura.id} className={`badge ${factura.estado}`}>
                      {factura.estado}
                    </span>,
                    `Q ${Number(factura.total).toFixed(2)}`,
                    <div key={`${factura.id}-acciones`} className="inline-actions">
                      <button
                        className="table-action"
                        onClick={() => void abrirFactura(factura.id)}
                      >
                        Abrir
                      </button>
                      {factura.estado === "borrador" && (
                        <button
                          className="table-action"
                          onClick={() => void cambiarEstadoFactura(factura.id, "confirmar")}
                        >
                          Confirmar
                        </button>
                      )}
                      {factura.estado === "pendiente" && (
                        <button
                          className="table-action"
                          onClick={() => void cambiarEstadoFactura(factura.id, "validar")}
                        >
                          Validar
                        </button>
                      )}
                      {factura.estado !== "borrador" && (
                        <button
                          className="table-action"
                          onClick={() =>
                            void cambiarEstadoFactura(
                              factura.id,
                              "restablecer-borrador"
                            )
                          }
                        >
                          Restablecer borrador
                        </button>
                      )}
                      <button
                        className="table-action"
                        onClick={() => void imprimirFactura(factura.id)}
                      >
                        Imprimir factura
                      </button>
                    </div>,
                  ]}
                />
              </div>
            </div>
          </section>
        )}

        {vistaActual === "inventario" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Modulo de inventario</h2>
                <p>Productos, categorias y stock por empresa.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void descargarReporte("inventario")}
              >
                Descargar Excel
              </button>
            </div>

            <div className="tabs">
              {[
                "stock",
                "entradas",
                "salidas",
                "ajustes",
                "kardex",
                "alertas",
                "productos",
                "categorias",
              ].map((tab) => (
                <button
                  key={tab}
                  className={tabInventario === tab ? "active" : ""}
                  onClick={() => setTabInventario(tab)}
                >
                  {tab === "stock"
                    ? "Stock actual"
                    : tab === "kardex"
                      ? "Kardex"
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {tabInventario === "stock" && (
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
            )}

            {tabInventario === "entradas" && (
              <MovimientosInventarioTable
                movimientos={movimientosInventario.filter((movimiento) =>
                  Number(movimiento.cantidad) > 0 ||
                  String(movimiento.tipo_movimiento).includes("entrada")
                )}
              />
            )}

            {tabInventario === "salidas" && (
              <MovimientosInventarioTable
                movimientos={movimientosInventario.filter((movimiento) =>
                  Number(movimiento.cantidad) < 0 ||
                  String(movimiento.tipo_movimiento).includes("salida")
                )}
              />
            )}

            {tabInventario === "ajustes" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={ajustarInventario}>
                  <h2>Ajustar stock</h2>
                  <select
                    value={ajusteInventarioForm.cod_producto}
                    onChange={(event) =>
                      setAjusteInventarioForm({
                        ...ajusteInventarioForm,
                        cod_producto: event.target.value,
                      })
                    }
                  >
                    <option value="">Selecciona producto</option>
                    {productos.map((producto) => (
                      <option key={producto.cod_producto} value={producto.cod_producto}>
                        {producto.cod_producto} - {producto.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ajusteInventarioForm.tipo_operacion}
                    onChange={(event) =>
                      setAjusteInventarioForm({
                        ...ajusteInventarioForm,
                        tipo_operacion: event.target.value,
                      })
                    }
                  >
                    <option value="aumentar">Aumentar stock</option>
                    <option value="disminuir">Disminuir stock</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={ajusteInventarioForm.cantidad}
                    onChange={(event) =>
                      setAjusteInventarioForm({
                        ...ajusteInventarioForm,
                        cantidad: event.target.value,
                      })
                    }
                    placeholder="Cantidad"
                  />
                  <input
                    value={ajusteInventarioForm.referencia}
                    onChange={(event) =>
                      setAjusteInventarioForm({
                        ...ajusteInventarioForm,
                        referencia: event.target.value,
                      })
                    }
                    placeholder="Referencia o motivo"
                  />
                  <button
                    type="submit"
                    disabled={!empresaActivaId || !ajusteInventarioForm.cod_producto}
                  >
                    Aplicar ajuste
                  </button>
                </form>

                <div>
                  <h2>Stock actual</h2>
                  <DataTable
                    columns={["Codigo", "Producto", "Stock", "Minimo", "Estado"]}
                    rows={inventario}
                    renderRow={(item) => [
                      item.cod_producto,
                      item.nombre,
                      item.stock_fisico,
                      item.stock_minimo,
                      <span key={item.id} className={`badge ${item.estado.toLowerCase()}`}>
                        {item.estado}
                      </span>,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabInventario === "kardex" && (
              <div>
                <div className="kardex-toolbar">
                  <select
                    value={kardexProducto}
                    onChange={(event) => {
                      setKardexProducto(event.target.value);
                      void cargarKardex(event.target.value);
                    }}
                  >
                    <option value="">Selecciona producto</option>
                    {productos.map((producto) => (
                      <option key={producto.cod_producto} value={producto.cod_producto}>
                        {producto.cod_producto} - {producto.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    onClick={() => void cargarKardex()}
                    disabled={!kardexProducto}
                  >
                    Actualizar
                  </button>
                </div>

                <DataTable
                  columns={[
                    "Fecha",
                    "Producto",
                    "Tipo",
                    "Referencia",
                    "Cantidad",
                    "Anterior",
                    "Nuevo",
                  ]}
                  rows={kardex}
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
              </div>
            )}

            {tabInventario === "alertas" && <AlertasPanel alertas={alertas} />}

            {tabInventario === "productos" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearProducto}>
                  <h2>Nuevo producto</h2>
                  <input
                    value={productoForm.cod_producto}
                    onChange={(event) =>
                      setProductoForm({
                        ...productoForm,
                        cod_producto: event.target.value,
                      })
                    }
                    placeholder="Codigo"
                  />
                  <input
                    value={productoForm.nombre}
                    onChange={(event) =>
                      setProductoForm({ ...productoForm, nombre: event.target.value })
                    }
                    placeholder="Nombre"
                  />
                  <select
                    value={productoForm.tipo}
                    onChange={(event) =>
                      setProductoForm({ ...productoForm, tipo: event.target.value })
                    }
                  >
                    <option value="producto">Producto</option>
                    <option value="servicio">Servicio</option>
                    <option value="insumo">Insumo</option>
                  </select>
                  <select
                    value={productoForm.categoria}
                    onChange={(event) =>
                      setProductoForm({
                        ...productoForm,
                        categoria: event.target.value,
                      })
                    }
                  >
                    <option value="">Sin categoria</option>
                    {categoriasProductos.map((categoria) => (
                      <option key={categoria.id} value={categoria.nombre}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={productoForm.descripcion}
                    onChange={(event) =>
                      setProductoForm({
                        ...productoForm,
                        descripcion: event.target.value,
                      })
                    }
                    placeholder="Descripcion"
                  />
                  <div className="form-row">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productoForm.precio_venta}
                      onChange={(event) =>
                        setProductoForm({
                          ...productoForm,
                          precio_venta: event.target.value,
                        })
                      }
                      placeholder="Precio venta"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={productoForm.stock_minimo}
                      onChange={(event) =>
                        setProductoForm({
                          ...productoForm,
                          stock_minimo: event.target.value,
                        })
                      }
                      placeholder="Stock minimo"
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productoForm.stock_inicial}
                    onChange={(event) =>
                      setProductoForm({
                        ...productoForm,
                        stock_inicial: event.target.value,
                      })
                    }
                    placeholder="Stock inicial"
                  />
                  <button type="submit" disabled={!empresaActivaId}>
                    Crear producto
                  </button>
                </form>

                <div>
                  <h2>Productos</h2>
                  <DataTable
                    columns={["Codigo", "Nombre", "Tipo", "Categoria", "Precio", "Stock"]}
                    rows={productos}
                    renderRow={(producto) => [
                      producto.cod_producto,
                      producto.nombre,
                      producto.tipo,
                      producto.categoria || "-",
                      `Q ${Number(producto.precio_venta).toFixed(2)}`,
                      producto.stock_fisico,
                    ]}
                  />
                </div>
              </div>
            )}

            {tabInventario === "categorias" && (
              <div className="settings-grid">
                <form className="admin-form" onSubmit={crearCategoriaProducto}>
                  <h2>Nueva categoria</h2>
                  <input
                    value={categoriaForm.nombre}
                    onChange={(event) =>
                      setCategoriaForm({
                        ...categoriaForm,
                        nombre: event.target.value,
                      })
                    }
                    placeholder="Nombre"
                  />
                  <input
                    value={categoriaForm.descripcion}
                    onChange={(event) =>
                      setCategoriaForm({
                        ...categoriaForm,
                        descripcion: event.target.value,
                      })
                    }
                    placeholder="Descripcion"
                  />
                  <button type="submit" disabled={!empresaActivaId}>
                    Crear categoria
                  </button>
                </form>

                <div>
                  <h2>Categorias de productos</h2>
                  <DataTable
                    columns={["Nombre", "Descripcion", "Empresa", "Estado"]}
                    rows={categoriasProductos}
                    renderRow={(categoria) => [
                      categoria.nombre,
                      categoria.descripcion || "-",
                      categoria.empresa,
                      categoria.estado,
                    ]}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {vistaActual === "empleados" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Empleados</h2>
                <p>Registro de empleados por empresa, puesto y departamento.</p>
              </div>
            </div>

            <div className="settings-grid">
              <form className="admin-form" onSubmit={crearEmpleado}>
                <h2>Nuevo empleado</h2>
                <input
                  value={empleadoForm.codigo}
                  onChange={(event) =>
                    setEmpleadoForm({ ...empleadoForm, codigo: event.target.value })
                  }
                  placeholder="Codigo"
                />
                <input
                  value={empleadoForm.nombre}
                  onChange={(event) =>
                    setEmpleadoForm({ ...empleadoForm, nombre: event.target.value })
                  }
                  placeholder="Nombre"
                />
                <input
                  value={empleadoForm.dpi}
                  onChange={(event) =>
                    setEmpleadoForm({ ...empleadoForm, dpi: event.target.value })
                  }
                  placeholder="DPI"
                />
                <div className="form-row">
                  <input
                    value={empleadoForm.puesto}
                    onChange={(event) =>
                      setEmpleadoForm({ ...empleadoForm, puesto: event.target.value })
                    }
                    placeholder="Puesto"
                  />
                  <input
                    value={empleadoForm.departamento}
                    onChange={(event) =>
                      setEmpleadoForm({
                        ...empleadoForm,
                        departamento: event.target.value,
                      })
                    }
                    placeholder="Departamento"
                  />
                </div>
                <input
                  type="date"
                  value={empleadoForm.fecha_ingreso}
                  onChange={(event) =>
                    setEmpleadoForm({
                      ...empleadoForm,
                      fecha_ingreso: event.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={empleadoForm.salario_base}
                  onChange={(event) =>
                    setEmpleadoForm({
                      ...empleadoForm,
                      salario_base: event.target.value,
                    })
                  }
                  placeholder="Salario base"
                />
                <button type="submit" disabled={!empresaActivaId}>
                  Crear empleado
                </button>
              </form>

              <div>
                <h2>Empleados activos</h2>
                <DataTable
                  columns={["Codigo", "Nombre", "Puesto", "Departamento", "Estado"]}
                  rows={empleados}
                  renderRow={(empleado) => [
                    empleado.codigo,
                    empleado.nombre,
                    empleado.puesto || "-",
                    empleado.departamento || "-",
                    empleado.estado,
                  ]}
                />
              </div>
            </div>
          </section>
        )}

        {vistaActual === "vacaciones" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Vacaciones</h2>
                <p>Solicitudes, aprobacion y rechazo de vacaciones.</p>
              </div>
            </div>

            <div className="settings-grid">
              <form className="admin-form" onSubmit={solicitarVacaciones}>
                <h2>Nueva solicitud</h2>
                <select
                  value={vacacionesForm.empleado_id}
                  onChange={(event) =>
                    setVacacionesForm({
                      ...vacacionesForm,
                      empleado_id: event.target.value,
                    })
                  }
                >
                  <option value="">Selecciona empleado</option>
                  {empleados.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre}
                    </option>
                  ))}
                </select>
                <div className="form-row">
                  <input
                    type="date"
                    value={vacacionesForm.fecha_inicio}
                    onChange={(event) =>
                      setVacacionesForm({
                        ...vacacionesForm,
                        fecha_inicio: event.target.value,
                      })
                    }
                  />
                  <input
                    type="date"
                    value={vacacionesForm.fecha_fin}
                    onChange={(event) =>
                      setVacacionesForm({
                        ...vacacionesForm,
                        fecha_fin: event.target.value,
                      })
                    }
                  />
                </div>
                <input
                  value={vacacionesForm.motivo}
                  onChange={(event) =>
                    setVacacionesForm({ ...vacacionesForm, motivo: event.target.value })
                  }
                  placeholder="Motivo"
                />
                <button
                  type="submit"
                  disabled={!empresaActivaId || !vacacionesForm.empleado_id}
                >
                  Solicitar vacaciones
                </button>
              </form>

              <div>
                <h2>Solicitudes</h2>
                <DataTable
                  columns={["Empleado", "Inicio", "Fin", "Dias", "Estado", "Accion"]}
                  rows={vacaciones}
                  renderRow={(solicitud) => [
                    solicitud.empleado,
                    new Date(solicitud.fecha_inicio).toLocaleDateString(),
                    new Date(solicitud.fecha_fin).toLocaleDateString(),
                    solicitud.dias_solicitados,
                    solicitud.estado,
                    solicitud.estado === "pendiente" ? (
                      <div key={`${solicitud.id}-acciones`} className="inline-actions">
                        <button
                          className="table-action"
                          onClick={() => void resolverVacaciones(solicitud.id, "aprobar")}
                        >
                          Aprobar
                        </button>
                        <button
                          className="table-action"
                          onClick={() => void resolverVacaciones(solicitud.id, "rechazar")}
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      "-"
                    ),
                  ]}
                />
              </div>
            </div>
          </section>
        )}

        {vistaActual === "reportes" && (
          <section className="panel">
            <h2>Reportes</h2>
            <p>Reportes operativos filtrados por empresa.</p>

            <div className="report-buttons">
              {["ventas", "inventario", "compras", "empleados", "vacaciones"].map(
                (tipo) => (
                  <button
                    key={tipo}
                    className="secondary-button"
                    onClick={() => void cargarReporteOperativo(tipo)}
                  >
                    Ver {tipo}
                  </button>
                )
              )}
              <button onClick={() => void descargarReporte("ventas")}>
                Descargar ventas Excel
              </button>

              <button onClick={() => void descargarReporte("inventario")}>
                Descargar inventario Excel
              </button>
            </div>

            {reporteActual && (
              <section className="embedded-panel report-preview">
                <h2>Reporte de {reporteActual.tipo}</h2>
                <ReporteOperativoTable reporte={reporteActual} />
              </section>
            )}
          </section>
        )}

        {vistaActual === "auditoria" && (
          <section className="panel">
            <h2>Auditoria</h2>
            <p>Eventos recientes del sistema.</p>
            <DataTable
              columns={["Fecha", "Empresa", "Accion", "Modulo", "Detalle"]}
              rows={eventosAuditoria}
              renderRow={(evento) => [
                new Date(evento.created_at).toLocaleString(),
                evento.empresa || "-",
                evento.accion,
                evento.modulo || "-",
                evento.detalle || "-",
              ]}
            />
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
