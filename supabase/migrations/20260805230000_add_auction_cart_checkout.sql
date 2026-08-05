create table public.auction_carts (
  id uuid primary key default gen_random_uuid(),
  bidder_name text not null,
  bidder_email text not null,
  bidder_phone text not null,
  preferred_payment_method text not null check (preferred_payment_method in ('pix', 'credit_card', 'debit_card', 'bank_transfer')),
  total_cents integer not null check (total_cents > 0),
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'approved', 'declined', 'paid')),
  created_at timestamptz not null default now()
);

create table public.auction_cart_items (
  cart_id uuid not null references public.auction_carts(id) on delete cascade,
  artwork_id bigint not null references public.artworks(id),
  amount_cents integer not null check (amount_cents > 0),
  primary key (cart_id, artwork_id)
);

create index auction_cart_items_artwork_id_idx on public.auction_cart_items(artwork_id);

alter table public.auction_carts enable row level security;
alter table public.auction_cart_items enable row level security;
revoke all on public.auction_carts, public.auction_cart_items from anon, authenticated;

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

  if preferred_payment_method not in ('pix', 'credit_card', 'debit_card', 'bank_transfer') then
    raise exception 'Escolha uma forma de pagamento válida.';
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
  values (btrim(bidder_name), lower(btrim(bidder_email)), btrim(bidder_phone), preferred_payment_method, calculated_total)
  returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select new_cart_id, (item ->> 'artwork_id')::bigint, (item ->> 'amount_cents')::integer
  from jsonb_array_elements(items) item;

  return new_cart_id;
end;
$$;

revoke all on function public.submit_auction_cart(text, text, text, text, jsonb) from public;
grant execute on function public.submit_auction_cart(text, text, text, text, jsonb) to anon, authenticated;
