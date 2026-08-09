-- Centralize the administrator identity check. This reads the verified Auth
-- email claim, not user-editable metadata.
create or replace function public.is_basilica_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'email'), '') = 'bmoweb@gmail.com';
$$;

revoke all on function public.is_basilica_admin() from public, anon;
grant execute on function public.is_basilica_admin() to authenticated;

drop policy if exists "admin_reads_auction_carts" on public.auction_carts;
create policy "admin_reads_auction_carts"
on public.auction_carts for select to authenticated
using ((select public.is_basilica_admin()));

drop policy if exists "admin_reads_auction_cart_items" on public.auction_cart_items;
create policy "admin_reads_auction_cart_items"
on public.auction_cart_items for select to authenticated
using ((select public.is_basilica_admin()));

-- The dashboard reads through this RPC so contact details never receive a
-- direct table grant. Authorization is enforced inside the definer function.
create or replace function public.admin_get_proposals()
returns table(
  id uuid,
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  preferred_payment_method text,
  total_cents integer,
  status text,
  created_at timestamptz,
  items jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso administrativo não autorizado.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.bidder_name,
    c.bidder_email,
    c.bidder_phone,
    c.preferred_payment_method,
    c.total_cents,
    c.status,
    c.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'artwork_id', ci.artwork_id,
          'artwork_code', a.code,
          'artwork_title', a.title,
          'amount_cents', ci.amount_cents,
          'artwork_status', a.status
        ) order by a.code
      ) filter (where ci.artwork_id is not null),
      '[]'::jsonb
    )
  from public.auction_carts c
  left join public.auction_cart_items ci on ci.cart_id = c.id
  left join public.artworks a on a.id = ci.artwork_id
  group by c.id
  order by c.created_at desc;
end;
$$;

revoke all on function public.admin_get_proposals() from public, anon;
grant execute on function public.admin_get_proposals() to authenticated;

-- Keep proposal and artwork states synchronized through explicit transitions.
create or replace function public.admin_update_cart_status(
  cart_id uuid,
  new_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso administrativo não autorizado.' using errcode = '42501';
  end if;

  if new_status not in ('reviewed', 'approved', 'declined', 'paid') then
    raise exception 'Status administrativo inválido.' using errcode = '22023';
  end if;

  select c.status
  into current_status
  from public.auction_carts c
  where c.id = cart_id
  for update;

  if not found then
    raise exception 'Intenção de compra não encontrada.' using errcode = 'P0002';
  end if;

  if current_status = new_status then
    return current_status;
  end if;

  if current_status = 'submitted' and new_status not in ('reviewed', 'approved', 'declined')
    or current_status = 'reviewed' and new_status not in ('approved', 'declined')
    or current_status = 'approved' and new_status not in ('paid', 'declined')
    or current_status in ('declined', 'paid') then
    raise exception 'Transição de status não permitida: % → %.', current_status, new_status
      using errcode = '22023';
  end if;

  if new_status = 'approved' then
    if exists (
      select 1
      from public.auction_cart_items ci
      join public.artworks a on a.id = ci.artwork_id
      where ci.cart_id = admin_update_cart_status.cart_id
        and a.status <> 'available'
    ) then
      raise exception 'Uma ou mais obras desta intenção já estão indisponíveis.'
        using errcode = 'P0001';
    end if;

    update public.artworks a
    set status = 'sold', updated_at = now()
    where a.id in (
      select ci.artwork_id
      from public.auction_cart_items ci
      where ci.cart_id = admin_update_cart_status.cart_id
    );
  elsif new_status = 'declined' and current_status = 'approved' then
    update public.artworks a
    set status = 'available', updated_at = now()
    where a.id in (
      select ci.artwork_id
      from public.auction_cart_items ci
      where ci.cart_id = admin_update_cart_status.cart_id
    )
      and not exists (
        select 1
        from public.auction_cart_items other_item
        join public.auction_carts other_cart on other_cart.id = other_item.cart_id
        where other_item.artwork_id = a.id
          and other_item.cart_id <> admin_update_cart_status.cart_id
          and other_cart.status in ('approved', 'paid')
      );
  end if;

  update public.auction_carts
  set status = new_status
  where id = cart_id;

  return new_status;
end;
$$;

revoke all on function public.admin_update_cart_status(uuid, text) from public, anon;
grant execute on function public.admin_update_cart_status(uuid, text) to authenticated;

-- Preserve the legacy approve RPC, but route it through the same guarded logic.
create or replace function public.admin_approve_cart(cart_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_update_cart_status(cart_id, 'approved');
end;
$$;

revoke all on function public.admin_approve_cart(uuid) from public, anon;
grant execute on function public.admin_approve_cart(uuid) to authenticated;

-- The current application no longer exposes the old single-artwork reservation
-- flow. Closing this legacy RPC prevents anonymous users from reserving the
-- entire catalog outside the checkout routine.
revoke all on function public.reserve_artwork(bigint, text, text, text)
from public, anon, authenticated;

-- Harden the public proposal endpoint. It remains intentionally callable by
-- visitors, but it can only insert bounded, validated data for available works.
create or replace function public.submit_auction_cart(
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  preferred_payment_method text,
  items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_cart_id uuid;
  item_count integer;
  distinct_item_count integer;
  available_count integer;
  calculated_total bigint;
  clean_name text := btrim(coalesce(bidder_name, ''));
  clean_email text := lower(btrim(coalesce(bidder_email, '')));
  clean_phone text := btrim(coalesce(bidder_phone, ''));
begin
  if char_length(clean_name) not between 2 and 120
    or char_length(clean_email) not between 5 and 160
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(clean_phone) not between 5 and 40 then
    raise exception 'Preencha nome, e-mail e WhatsApp corretamente.' using errcode = '22023';
  end if;

  if preferred_payment_method <> 'in_person' then
    raise exception 'O pagamento desta edição é presencial.' using errcode = '22023';
  end if;

  if items is null or jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'A sacola deve ter entre 1 e 20 obras.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'artwork_id', '') !~ '^[0-9]+$'
      or coalesce(item ->> 'amount_cents', '') !~ '^[0-9]+$'
      or (item ->> 'amount_cents')::bigint not between 100 and 100000000
  ) then
    raise exception 'Revise os lances informados.' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct (item ->> 'artwork_id')::bigint),
    coalesce(sum((item ->> 'amount_cents')::bigint), 0)
  into item_count, distinct_item_count, calculated_total
  from jsonb_array_elements(items) item;

  if item_count <> distinct_item_count or calculated_total > 2000000000 then
    raise exception 'Revise os lances informados.' using errcode = '22023';
  end if;

  select count(*)
  into available_count
  from public.artworks a
  where a.status = 'available'
    and a.id in (
      select (item ->> 'artwork_id')::bigint
      from jsonb_array_elements(items) item
    );

  if available_count <> item_count then
    raise exception 'Uma ou mais obras não estão mais disponíveis para proposta.' using errcode = 'P0001';
  end if;

  insert into public.auction_carts (
    bidder_name,
    bidder_email,
    bidder_phone,
    preferred_payment_method,
    total_cents
  ) values (
    clean_name,
    clean_email,
    clean_phone,
    'in_person',
    calculated_total::integer
  )
  returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select
    new_cart_id,
    (item ->> 'artwork_id')::bigint,
    (item ->> 'amount_cents')::integer
  from jsonb_array_elements(items) item;

  return new_cart_id;
end;
$$;

revoke all on function public.submit_auction_cart(text, text, text, text, jsonb)
from public;
grant execute on function public.submit_auction_cart(text, text, text, text, jsonb)
to anon, authenticated;
