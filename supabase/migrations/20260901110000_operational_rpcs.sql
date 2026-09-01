-- Operational RPCs used by the pre-reservation and admin flows.
-- Versioned for reproducibility; production already has these functions.
-- Re-applying is safe (CREATE OR REPLACE).

alter table public.auction_carts
  add column if not exists expires_at timestamptz,
  add column if not exists confirmation_code text,
  add column if not exists extra_contribution_cents integer default 0;

alter table public.artworks
  add column if not exists reserved_until timestamptz;

create or replace function public.release_expired_pre_reservations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired_carts as (
    update public.auction_carts c
    set status = 'expired', updated_at = now()
    where c.status = 'reserved'
      and c.expires_at is not null
      and c.expires_at <= now()
    returning c.id
  )
  update public.artworks a
  set status = 'available', reserved_until = null, updated_at = now()
  from public.auction_cart_items ci
  join expired_carts ec on ec.id = ci.cart_id
  where a.id = ci.artwork_id
    and a.status = 'reserved';
end;
$$;

revoke all on function public.release_expired_pre_reservations() from public;
grant execute on function public.release_expired_pre_reservations() to service_role;

create or replace function public.admin_update_cart_status(cart_id uuid, new_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_status text := lower(btrim(coalesce(new_status, '')));
  artwork_ids bigint[];
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if clean_status not in (
    'reserved', 'submitted', 'reviewed', 'approved', 'declined', 'paid', 'expired'
  ) then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;

  select array_agg(ci.artwork_id)
  into artwork_ids
  from public.auction_cart_items ci
  where ci.cart_id = admin_update_cart_status.cart_id;

  if artwork_ids is null then
    raise exception 'Intenção não encontrada.' using errcode = 'P0002';
  end if;

  update public.auction_carts
  set status = clean_status, updated_at = now()
  where id = admin_update_cart_status.cart_id;

  if not found then
    raise exception 'Intenção não encontrada.' using errcode = 'P0002';
  end if;

  if clean_status in ('approved', 'paid') then
    update public.artworks
    set status = 'sold', reserved_until = null, updated_at = now()
    where id = any(artwork_ids)
      and status in ('reserved', 'available');
  elsif clean_status in ('declined', 'expired') then
    update public.artworks
    set status = 'available', reserved_until = null, updated_at = now()
    where id = any(artwork_ids)
      and status = 'reserved';
  end if;
end;
$$;

revoke all on function public.admin_update_cart_status(uuid, text) from public, anon;
grant execute on function public.admin_update_cart_status(uuid, text) to authenticated, service_role;

-- Legacy alias kept for compatibility with older admin tooling.
create or replace function public.admin_approve_cart(cart_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.admin_update_cart_status(cart_id, 'approved');
end;
$$;

revoke all on function public.admin_approve_cart(uuid) from public, anon;
grant execute on function public.admin_approve_cart(uuid) to authenticated, service_role;
