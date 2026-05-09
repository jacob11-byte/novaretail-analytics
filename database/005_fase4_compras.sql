create table if not exists proveedores (
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

create table if not exists compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  proveedor_id uuid references proveedores(id),
  usuario_id text,
  numero text not null,
  fecha date not null default current_date,
  estado text not null default 'borrador',
  subtotal numeric(14, 2) not null default 0,
  impuestos numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists compra_detalle (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  producto_id text,
  cod_producto text,
  descripcion text,
  cantidad numeric(14, 2) not null default 1,
  costo_unitario numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0
);

create index if not exists idx_proveedores_empresa
  on proveedores(empresa_id);

create index if not exists idx_compras_empresa
  on compras(empresa_id);

create index if not exists idx_compras_proveedor
  on compras(proveedor_id);

create index if not exists idx_compra_detalle_compra
  on compra_detalle(compra_id);
