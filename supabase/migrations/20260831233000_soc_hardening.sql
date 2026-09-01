-- Security hardening for the public API surface and the administrative PII flow.

revoke create on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
create or replace function public.is_basilica_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'basilica_admin'), 'false') = 'true';
$$;

revoke all on function public.is_basilica_admin() from public, anon;
grant execute on function public.is_basilica_admin() to authenticated, service_role;

drop function if exists public.admin_get_proposals();
create function public.admin_get_proposals()
returns table (
  id uuid,
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  preferred_payment_method text,
  total_cents integer,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  confirmation_code text,
  extra_contribution_cents integer,
  items jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso administrativo não autorizado.' using errcode = '42501';
  end if;

  return query
  select c.id, c.bidder_name, c.bidder_email, c.bidder_phone,
    c.preferred_payment_method, c.total_cents, c.status, c.created_at,
    c.expires_at, c.confirmation_code, coalesce(c.extra_contribution_cents, 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'artwork_id', ci.artwork_id,
      'artwork_code', a.code,
      'artwork_title', a.title,
      'amount_cents', ci.amount_cents,
      'artwork_status', a.status
    ) order by a.code) filter (where ci.artwork_id is not null), '[]'::jsonb)
  from public.auction_carts c
  left join public.auction_cart_items ci on ci.cart_id = c.id
  left join public.artworks a on a.id = ci.artwork_id
  group by c.id
  order by c.created_at desc;
end;
$$;

revoke all on function public.admin_get_proposals() from public, anon;
grant execute on function public.admin_get_proposals() to authenticated, service_role;

alter function public.admin_approve_cart(uuid) security invoker;
alter function public.admin_update_cart_status(uuid, text) security invoker;
alter function public.admin_set_artwork_available(bigint) security invoker;
alter function public.admin_update_artwork_price(bigint, integer) security invoker;

revoke all on function public.admin_approve_cart(uuid) from public, anon;
revoke all on function public.admin_update_cart_status(uuid, text) from public, anon;
revoke all on function public.admin_set_artwork_available(bigint) from public, anon;
revoke all on function public.admin_update_artwork_price(bigint, integer) from public, anon;
grant execute on function public.admin_approve_cart(uuid) to authenticated, service_role;
grant execute on function public.admin_update_cart_status(uuid, text) to authenticated, service_role;
grant execute on function public.admin_set_artwork_available(bigint) to authenticated, service_role;
grant execute on function public.admin_update_artwork_price(bigint, integer) to authenticated, service_role;

revoke all on function public.get_public_artworks() from public, anon, authenticated;
revoke all on function public.release_expired_pre_reservations() from public, anon, authenticated;
revoke all on function public.submit_purchase_intent(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.reserve_artwork(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.submit_auction_cart(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.get_public_artworks() to service_role;
grant execute on function public.release_expired_pre_reservations() to service_role;
grant execute on function public.submit_purchase_intent(text, text, text, jsonb) to service_role;
grant execute on function public.reserve_artwork(bigint, text, text, text) to service_role;
grant execute on function public.submit_auction_cart(text, text, text, text, jsonb) to service_role;

create unique index if not exists auction_carts_confirmation_code_unique
  on public.auction_carts (confirmation_code)
  where confirmation_code is not null;

create or replace function public.submit_pre_reservation(
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  items jsonb,
  extra_contribution_cents integer default 0,
  hold_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_cart_id uuid;
  item_count integer;
  distinct_item_count integer;
  available_count integer;
  recent_request_count integer;
  calculated_total bigint;
  expires_at_value timestamptz;
  confirmation_code_value text;
  clean_name text := btrim(coalesce(bidder_name, ''));
  clean_email text := lower(btrim(coalesce(bidder_email, '')));
  clean_phone text := btrim(coalesce(bidder_phone, ''));
  phone_digits text := regexp_replace(btrim(coalesce(bidder_phone, '')), '[^0-9]', '', 'g');
begin
  perform public.release_expired_pre_reservations();

  if char_length(clean_name) not between 2 and 120
    or char_length(clean_email) not between 5 and 160
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(clean_phone) not between 8 and 40
    or char_length(phone_digits) not between 8 and 15 then
    raise exception 'Preencha nome, e-mail e WhatsApp corretamente.' using errcode = '22023';
  end if;

  if items is null or jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'A seleção deve ter entre 1 e 20 obras.' using errcode = '22023';
  end if;

  if coalesce(extra_contribution_cents, 0) < 0 or coalesce(extra_contribution_cents, 0) > 100000000 then
    raise exception 'O valor da contribuição adicional é inválido.' using errcode = '22023';
  end if;

  if hold_minutes < 10 or hold_minutes > 1440 then
    raise exception 'O tempo de pré-reserva é inválido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(items) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'artwork_id', '') !~ '^[0-9]+$'
      or item ? 'amount_cents'
  ) then
    raise exception 'A seleção contém dados inválidos.' using errcode = '22023';
  end if;

  select count(*), count(distinct (item ->> 'artwork_id')::bigint)
  into item_count, distinct_item_count
  from jsonb_array_elements(items) item;

  if item_count <> distinct_item_count then
    raise exception 'Uma obra não pode aparecer duas vezes na mesma seleção.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clean_email || ':' || phone_digits, 0));
  select count(*) into recent_request_count
  from public.auction_carts c
  where c.created_at >= now() - interval '1 hour'
    and (lower(c.bidder_email) = clean_email
      or regexp_replace(c.bidder_phone, '[^0-9]', '', 'g') = phone_digits);
  if recent_request_count >= 5 then
    raise exception 'Limite temporário de pré-reservas atingido. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;

  perform 1
  from public.artworks a
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item)
  order by a.id
  for update;

  select count(*), coalesce(sum(a.price_cents), 0)
  into available_count, calculated_total
  from public.artworks a
  where a.status = 'available'
    and a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item);

  if available_count <> item_count then
    raise exception 'Uma ou mais obras acabaram de ser pré-reservadas ou adquiridas.' using errcode = 'P0001';
  end if;

  calculated_total := calculated_total + coalesce(extra_contribution_cents, 0);
  if calculated_total < 100 or calculated_total > 2000000000 then
    raise exception 'O valor total da seleção é inválido.' using errcode = '22023';
  end if;

  expires_at_value := now() + make_interval(mins => hold_minutes);
  confirmation_code_value := 'BAS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.auction_carts (
    bidder_name, bidder_email, bidder_phone, preferred_payment_method,
    total_cents, status, expires_at, extra_contribution_cents, confirmation_code
  ) values (
    clean_name, clean_email, clean_phone, 'in_person',
    calculated_total::integer, 'reserved', expires_at_value,
    coalesce(extra_contribution_cents, 0), confirmation_code_value
  ) returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select new_cart_id, a.id, a.price_cents
  from public.artworks a
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item);

  update public.artworks a
  set status = 'reserved', reserved_until = expires_at_value, updated_at = now()
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item)
    and a.status = 'available';

  if not found then
    raise exception 'Não foi possível concluir a pré-reserva.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'reservation_id', new_cart_id,
    'confirmation_code', confirmation_code_value,
    'expires_at', expires_at_value,
    'base_total_cents', calculated_total - coalesce(extra_contribution_cents, 0),
    'extra_contribution_cents', coalesce(extra_contribution_cents, 0),
    'total_cents', calculated_total
  );
end;
$$;

revoke all on function public.submit_pre_reservation(text, text, text, jsonb, integer, integer) from public;
grant execute on function public.submit_pre_reservation(text, text, text, jsonb, integer, integer) to anon, authenticated, service_role;
