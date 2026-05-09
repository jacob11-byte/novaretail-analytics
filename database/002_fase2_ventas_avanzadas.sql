create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nombre text not null,
  nit text,
  telefono text,
  email text,
  direccion text,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  numero text not null,
  cliente_id uuid references clientes(id),
  vendedor_id text,
  fecha_creacion date not null default current_date,
  fecha_vencimiento date,
  lista_precios text,
  terminos_pago text,
  estado text not null default 'cotizacion',
  subtotal numeric(14, 2) not null default 0,
  impuestos numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists cotizacion_detalle (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  producto_id text,
  descripcion text,
  cantidad numeric(14, 2) not null default 1,
  unidad text not null default 'unidad',
  precio_unitario numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(6, 2) not null default 12,
  subtotal numeric(14, 2) not null default 0
);

create table if not exists ordenes_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  numero text not null,
  cotizacion_id uuid references cotizaciones(id),
  cliente_id uuid references clientes(id),
  vendedor_id text,
  fecha_orden date not null default current_date,
  estado text not null default 'orden_venta',
  subtotal numeric(14, 2) not null default 0,
  impuestos numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  orden_despacho text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists orden_venta_detalle (
  id uuid primary key default gen_random_uuid(),
  orden_venta_id uuid not null references ordenes_venta(id) on delete cascade,
  producto_id text,
  descripcion text,
  cantidad numeric(14, 2) not null default 1,
  unidad text not null default 'unidad',
  precio_unitario numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(6, 2) not null default 12,
  subtotal numeric(14, 2) not null default 0
);

create index if not exists idx_clientes_empresa on clientes(empresa_id);
create index if not exists idx_cotizaciones_empresa on cotizaciones(empresa_id);
create index if not exists idx_cotizaciones_cliente on cotizaciones(cliente_id);
create index if not exists idx_ordenes_venta_empresa on ordenes_venta(empresa_id);
create index if not exists idx_ordenes_venta_cliente on ordenes_venta(cliente_id);
