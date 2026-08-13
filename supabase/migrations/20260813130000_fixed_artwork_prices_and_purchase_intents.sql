alter table public.artworks
  add column if not exists price_cents integer;

update public.artworks
set price_cents = 3000000
where price_cents is null;

alter table public.artworks
  alter column price_cents set default 3000000,
  alter column price_cents set not null;

alter table public.artworks
  drop constraint if exists artworks_price_cents_check;

alter table public.artworks
  add constraint artworks_price_cents_check
  check (price_cents between 100 and 100000000);

create or replace function public.submit_purchase_intent(
  bidder_name text,
  bidder_email text,
  bidder_phone text,
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
    or char_length(clean_phone) not between 8 and 40 then
    raise exception 'Preencha nome, e-mail e WhatsApp corretamente.' using errcode = '22023';
  end if;

  if items is null or jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'A seleção deve ter entre 1 e 20 obras.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) item
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

  select count(*), coalesce(sum(a.price_cents), 0)
  into available_count, calculated_total
  from public.artworks a
  where a.status = 'available'
    and a.id in (
      select (item ->> 'artwork_id')::bigint
      from jsonb_array_elements(items) item
    );

  if available_count <> item_count then
    raise exception 'Uma ou mais obras não estão mais disponíveis para intenção.' using errcode = 'P0001';
  end if;

  if calculated_total < 100 or calculated_total > 2000000000 then
    raise exception 'O valor total da seleção é inválido.' using errcode = '22023';
  end if;

  insert into public.auction_carts (
    bidder_name, bidder_email, bidder_phone, preferred_payment_method, total_cents
  ) values (
    clean_name, clean_email, clean_phone, 'in_person', calculated_total::integer
  ) returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select new_cart_id, a.id, a.price_cents
  from public.artworks a
  where a.id in (
    select (item ->> 'artwork_id')::bigint
    from jsonb_array_elements(items) item
  );

  return new_cart_id;
end;
$$;

revoke execute on function public.submit_purchase_intent(text, text, text, jsonb) from public;
grant execute on function public.submit_purchase_intent(text, text, text, jsonb) to anon, authenticated;

revoke execute on function public.submit_auction_cart(text, text, text, text, jsonb) from public;
revoke execute on function public.submit_auction_cart(text, text, text, text, jsonb) from anon;
revoke execute on function public.submit_auction_cart(text, text, text, text, jsonb) from authenticated;
