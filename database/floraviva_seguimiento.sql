-- FloraViva: observaciones, producción por cultivo y foro comunitario.
-- Ejecuta este archivo completo en Supabase > SQL Editor > New query.

create table if not exists public.observaciones_cultivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cultivo_id uuid not null references public.cultivos(id) on delete cascade,
  observacion text not null check (char_length(trim(observacion)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.produccion_cultivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cultivo_id uuid not null references public.cultivos(id) on delete cascade,
  fecha date not null default current_date,
  cantidad_frutos integer not null check (cantidad_frutos >= 0),
  notas text check (notas is null or char_length(notas) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.foro_publicaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  autor_nombre text not null default 'Comunidad FloraViva',
  titulo text not null check (char_length(trim(titulo)) between 1 and 140),
  categoria text not null default 'Consejos' check (categoria in ('Consejos','Identificación','Plagas y enfermedades','Riego y suelo','Cosechas','Observaciones')),
  contenido text not null check (char_length(trim(contenido)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists observaciones_cultivo_usuario_fecha_idx
  on public.observaciones_cultivo (user_id, created_at desc);
create index if not exists produccion_cultivo_usuario_fecha_idx
  on public.produccion_cultivo (user_id, fecha desc);
create index if not exists foro_publicaciones_fecha_idx
  on public.foro_publicaciones (created_at desc);

alter table public.observaciones_cultivo enable row level security;
alter table public.produccion_cultivo enable row level security;
alter table public.foro_publicaciones enable row level security;

grant select, insert on public.observaciones_cultivo to authenticated;
grant select, insert on public.produccion_cultivo to authenticated;
grant select, insert on public.foro_publicaciones to authenticated;

drop policy if exists "Ver mis observaciones" on public.observaciones_cultivo;
create policy "Ver mis observaciones" on public.observaciones_cultivo
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Crear observaciones de mis cultivos" on public.observaciones_cultivo;
create policy "Crear observaciones de mis cultivos" on public.observaciones_cultivo
  for insert to authenticated with check (
    auth.uid() = user_id and exists (
      select 1 from public.cultivos c
      where c.id = cultivo_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Ver mi producción" on public.produccion_cultivo;
create policy "Ver mi producción" on public.produccion_cultivo
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Registrar producción de mis cultivos" on public.produccion_cultivo;
create policy "Registrar producción de mis cultivos" on public.produccion_cultivo
  for insert to authenticated with check (
    auth.uid() = user_id and exists (
      select 1 from public.cultivos c
      where c.id = cultivo_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Leer foro como usuario autenticado" on public.foro_publicaciones;
create policy "Leer foro como usuario autenticado" on public.foro_publicaciones
  for select to authenticated using (true);
drop policy if exists "Publicar en foro como usuario autenticado" on public.foro_publicaciones;
create policy "Publicar en foro como usuario autenticado" on public.foro_publicaciones
  for insert to authenticated with check (auth.uid() = user_id);

-- El nombre público se deriva del perfil de autenticación; no se confía en el nombre enviado por el navegador.
create or replace function public.floraviva_set_forum_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nombre_perfil text;
  correo text;
begin
  new.user_id := auth.uid();
  select raw_user_meta_data ->> 'nombre', email
    into nombre_perfil, correo
    from auth.users
    where id = auth.uid();
  new.autor_nombre := coalesce(nullif(trim(nombre_perfil), ''), nullif(split_part(coalesce(correo, ''), '@', 1), ''), 'Comunidad FloraViva');
  return new;
end;
$$;

drop trigger if exists trg_floraviva_set_forum_author on public.foro_publicaciones;
create trigger trg_floraviva_set_forum_author
before insert on public.foro_publicaciones
for each row execute function public.floraviva_set_forum_author();
