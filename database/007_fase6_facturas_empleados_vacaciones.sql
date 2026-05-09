create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  cliente_id uuid references clientes(id),
  usuario_id text,
  numero text not null,
  fecha date not null default current_date,
  estado text not null default 'borrador',
  subtotal numeric(14, 2) not null default 0,
  impuestos numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists factura_detalle (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  producto_id text,
  cod_producto text,
  descripcion text,
  cantidad numeric(14, 2) not null default 1,
  precio_unitario numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(6, 2) not null default 12,
  subtotal numeric(14, 2) not null default 0
);

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  usuario_id text,
  codigo text not null,
  nombre text not null,
  dpi text,
  telefono text,
  email text,
  direccion text,
  puesto text,
  departamento text,
  fecha_ingreso date,
  salario_base numeric(14, 2) not null default 0,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists vacaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  empleado_id uuid not null references empleados(id),
  fecha_inicio date not null,
  fecha_fin date not null,
  dias_solicitados integer not null default 0,
  motivo text,
  estado text not null default 'pendiente',
  aprobado_por text,
  comentario_aprobacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facturas_empresa_estado
  on facturas(empresa_id, estado);

create index if not exists idx_factura_detalle_factura
  on factura_detalle(factura_id);

create index if not exists idx_empleados_empresa_estado
  on empleados(empresa_id, estado);

create index if not exists idx_vacaciones_empresa_estado
  on vacaciones(empresa_id, estado);

create index if not exists idx_vacaciones_empleado
  on vacaciones(empleado_id);
