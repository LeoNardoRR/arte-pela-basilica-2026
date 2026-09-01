create or replace function public.is_basilica_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'basilica_admin'), 'false') = 'true';
$$;

revoke all on function public.is_basilica_admin() from public, anon;
grant execute on function public.is_basilica_admin() to authenticated, service_role;
