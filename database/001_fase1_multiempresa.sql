create extension if not exists pgcrypto;

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  direccion text,
  telefono text,
  email text,
  estado text not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  usuario_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into usuario_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'usuarios'
    and a.attname = 'id'
    and not a.attisdropped;

  if usuario_id_type is null then
    raise exception 'No existe public.usuarios.id';
  end if;

  execute format(
    'create table if not exists usuario_empresas (
      id uuid primary key default gen_random_uuid(),
      usuario_id %s not null references usuarios(id) on delete cascade,
      empresa_id uuid not null references empresas(id) on delete cascade,
      rol text not null default ''vendedor'',
      created_at timestamptz not null default now(),
      unique (usuario_id, empresa_id)
    )',
    usuario_id_type
  );
end $$;

alter table usuarios
  add column if not exists intentos_fallidos integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table auditoria add column if not exists empresa_id uuid references empresas(id);
alter table auditoria add column if not exists modulo text;
alter table auditoria add column if not exists ip text;

alter table ventas add column if not exists empresa_id uuid references empresas(id);
alter table productos add column if not exists empresa_id uuid references empresas(id);
alter table inventario add column if not exists empresa_id uuid references empresas(id);

insert into empresas (nombre, nit, direccion, telefono, email, estado)
select 'NovaRetail Demo', 'CF', 'Ciudad de Guatemala', '', 'admin@novaretail.com', 'activa'
where not exists (select 1 from empresas);

update ventas
set empresa_id = (select id from empresas order by created_at asc limit 1)
where empresa_id is null;

update productos
set empresa_id = (select id from empresas order by created_at asc limit 1)
where empresa_id is null;

update inventario
set empresa_id = (select id from empresas order by created_at asc limit 1)
where empresa_id is null;

insert into usuario_empresas (usuario_id, empresa_id, rol)
select u.id, e.id, u.rol
from usuarios u
cross join empresas e
where u.rol = 'admin'
on conflict (usuario_id, empresa_id) do nothing;

create index if not exists idx_usuario_empresas_usuario
  on usuario_empresas(usuario_id);

create index if not exists idx_usuario_empresas_empresa
  on usuario_empresas(empresa_id);

create index if not exists idx_ventas_empresa
  on ventas(empresa_id);

create index if not exists idx_productos_empresa
  on productos(empresa_id);

create index if not exists idx_inventario_empresa
  on inventario(empresa_id);
