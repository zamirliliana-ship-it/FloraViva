-- Verificación de correo FloraViva. Ejecutar una sola vez en Supabase SQL Editor.
create table if not exists public.user_email_challenges (
 email text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 code_hash text not null, expires_at timestamptz not null, requested_at timestamptz not null default now(),
 attempts integer not null default 0 check (attempts >= 0), used_at timestamptz null
);
alter table public.user_email_challenges enable row level security;
revoke all on table public.user_email_challenges from anon, authenticated;
grant all on table public.user_email_challenges to service_role;
