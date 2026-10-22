-- Ejecutar una sola vez en Supabase SQL Editor.
create table if not exists public.admin_login_challenges (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    requested_at timestamptz not null default now(),
    attempts integer not null default 0 check (attempts >= 0),
    used_at timestamptz null
);
alter table public.admin_login_challenges enable row level security;
revoke all on table public.admin_login_challenges from anon, authenticated;
grant all on table public.admin_login_challenges to service_role;
create or replace function public.consume_admin_login_code(p_user_id uuid, p_code_hash text)
returns table(valid boolean, attempts integer) language plpgsql security invoker set search_path = '' as $$
declare v_reto public.admin_login_challenges%rowtype; v_intentos integer; v_valido boolean := false;
begin
 select * into v_reto from public.admin_login_challenges where user_id = p_user_id for update;
 if not found then return query select false, 0; return; end if;
 v_intentos := v_reto.attempts + 1;
 if v_reto.used_at is null and v_reto.expires_at > now() and v_reto.attempts < 5 and v_reto.code_hash = p_code_hash then v_valido := true; end if;
 update public.admin_login_challenges set attempts=v_intentos, used_at=case when v_valido then now() else used_at end where user_id=p_user_id;
 return query select v_valido, v_intentos;
end; $$;
revoke all on function public.consume_admin_login_code(uuid,text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_code(uuid,text) to service_role;
