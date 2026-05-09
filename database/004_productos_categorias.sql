create table if not exists categorias_productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nombre text not null,
  descripcion text,
  estado text not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

alter table productos add column if not exists tipo text default 'producto';
alter table productos add column if not exists descripcion text;
alter table productos add column if not exists precio_venta numeric(14, 2) not null default 0;
alter table productos add column if not exists estado text not null default 'activo';
alter table productos add column if not exists created_at timestamptz not null default now();
alter table productos add column if not exists updated_at timestamptz not null default now();

insert into categorias_productos (empresa_id, nombre)
select distinct p.empresa_id, p.categoria
from productos p
where p.empresa_id is not null
  and p.categoria is not null
  and p.categoria <> ''
on conflict (empresa_id, nombre) do nothing;

create index if not exists idx_categorias_productos_empresa
  on categorias_productos(empresa_id);

create index if not exists idx_productos_empresa_codigo
  on productos(empresa_id, cod_producto);
