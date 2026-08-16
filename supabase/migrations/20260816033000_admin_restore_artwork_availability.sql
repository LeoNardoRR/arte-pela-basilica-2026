create or replace function public.admin_set_artwork_available(artwork_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_basilica_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  update public.artworks
  set status = 'available', reserved_until = null, updated_at = now()
  where id = artwork_id;

  if not found then
    raise exception 'Obra não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_artwork_available(bigint) from public;
grant execute on function public.admin_set_artwork_available(bigint) to authenticated;
