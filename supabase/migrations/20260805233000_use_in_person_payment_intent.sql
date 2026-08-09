alter table public.auction_carts
  drop constraint auction_carts_preferred_payment_method_check,
  add constraint auction_carts_preferred_payment_method_check
    check (preferred_payment_method = 'in_person');

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
set search_path = public, pg_temp
as $$
declare
  new_cart_id uuid;
  item_count integer;
  distinct_item_count integer;
  available_count integer;
  calculated_total integer;
begin
  if btrim(bidder_name) = '' or btrim(bidder_email) = '' or btrim(bidder_phone) = '' then
    raise exception 'Preencha seus dados de contato.';
  end if;

  if preferred_payment_method <> 'in_person' then
    raise exception 'O pagamento desta edição é presencial.';
  end if;

  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'A sacola deve ter entre 1 e 20 obras.';
  end if;

  select count(*), count(distinct (item ->> 'artwork_id')::bigint), coalesce(sum((item ->> 'amount_cents')::integer), 0)
    into item_count, distinct_item_count, calculated_total
  from jsonb_array_elements(items) item;

  if item_count <> distinct_item_count or calculated_total <= 0 or exists (
    select 1 from jsonb_array_elements(items) item
    where coalesce((item ->> 'amount_cents')::integer, 0) <= 0
  ) then
    raise exception 'Revise os lances informados.';
  end if;

  select count(*) into available_count
  from public.artworks a
  where a.status = 'available'
    and a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item);

  if available_count <> item_count then
    raise exception 'Uma ou mais obras não estão mais disponíveis para proposta.';
  end if;

  insert into public.auction_carts (bidder_name, bidder_email, bidder_phone, preferred_payment_method, total_cents)
  values (btrim(bidder_name), lower(btrim(bidder_email)), btrim(bidder_phone), 'in_person', calculated_total)
  returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select new_cart_id, (item ->> 'artwork_id')::bigint, (item ->> 'amount_cents')::integer
  from jsonb_array_elements(items) item;

  return new_cart_id;
end;
$$;
