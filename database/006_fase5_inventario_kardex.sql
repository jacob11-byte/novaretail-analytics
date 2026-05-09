create table if not exists movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  producto_id text,
  cod_producto text not null,
  tipo_movimiento text not null,
  referencia text,
  cantidad numeric(14, 2) not null,
  stock_anterior numeric(14, 2) not null default 0,
  stock_nuevo numeric(14, 2) not null default 0,
  usuario_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_inventario_empresa_producto
  on movimientos_inventario(empresa_id, cod_producto, created_at desc);

create index if not exists idx_movimientos_inventario_tipo
  on movimientos_inventario(tipo_movimiento);
