-- Direct table UPDATE was revoked, so authorized admin mutations must run
-- through checked SECURITY DEFINER functions.
alter table public.auction_carts
  add column if not exists updated_at timestamptz default now();

alter function public.admin_update_cart_status(uuid, text) security definer;
revoke all on function public.admin_update_cart_status(uuid, text) from public, anon;
grant execute on function public.admin_update_cart_status(uuid, text) to authenticated, service_role;

create or replace function public.admin_set_artwork_available(artwork_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_cart_id uuid;
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  -- Keep the reservation history and catalog status in sync. A reservation
  -- containing several artworks is canceled as a whole.
  select c.id into active_cart_id
  from public.auction_carts c
  join public.auction_cart_items ci on ci.cart_id = c.id
  join public.artworks a on a.id = ci.artwork_id
  where ci.artwork_id = admin_set_artwork_available.artwork_id
    and c.status in ('reserved', 'submitted', 'reviewed')
    and a.status = 'reserved'
    and a.reserved_until is not distinct from c.expires_at
  order by c.created_at desc
  limit 1;

  if active_cart_id is not null then
    perform public.admin_update_cart_status(active_cart_id, 'declined');
  else
    update public.artworks
    set status = 'available', reserved_until = null, updated_at = now()
    where id = artwork_id;
    if not found then
      raise exception 'Obra não encontrada.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

revoke all on function public.admin_set_artwork_available(bigint) from public, anon;
grant execute on function public.admin_set_artwork_available(bigint) to authenticated, service_role;

-- The existing price Save button is affected by the same revoked grant.
alter function public.admin_update_artwork_price(bigint, integer) security definer;
revoke all on function public.admin_update_artwork_price(bigint, integer) from public, anon;
grant execute on function public.admin_update_artwork_price(bigint, integer) to authenticated, service_role;
