create table if not exists punto_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  usuario_id text,
  fecha timestamptz not null default now(),
  subtotal numeric(14, 2) not null default 0,
  impuestos numeric(14, 2) not null default 0,
  descuento numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  metodo_pago text not null default 'efectivo',
  estado text not null default 'finalizada',
  created_at timestamptz not null default now()
);

create table if not exists punto_venta_detalle (
  id uuid primary key default gen_random_uuid(),
  punto_venta_id uuid not null references punto_venta(id) on delete cascade,
  producto_id text,
  cod_producto text,
  descripcion text,
  cantidad numeric(14, 2) not null default 1,
  precio_unitario numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0
);

create table if not exists cortes_caja (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  usuario_id text,
  fecha_apertura timestamptz not null default now(),
  fecha_cierre timestamptz,
  monto_inicial numeric(14, 2) not null default 0,
  ventas_efectivo numeric(14, 2) not null default 0,
  ventas_tarjeta numeric(14, 2) not null default 0,
  ventas_transferencia numeric(14, 2) not null default 0,
  total_ventas numeric(14, 2) not null default 0,
  estado text not null default 'abierto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_punto_venta_empresa_fecha
  on punto_venta(empresa_id, fecha);

create index if not exists idx_punto_venta_detalle_venta
  on punto_venta_detalle(punto_venta_id);

create index if not exists idx_cortes_caja_empresa_estado
  on cortes_caja(empresa_id, estado);
