create or replace function public.is_basilica_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'ribeiroleonardoti@gmail.com';
$$;
