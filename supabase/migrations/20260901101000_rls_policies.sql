-- Row Level Security aligned with production (catalog public read, PII via admin only).

alter table public.artworks enable row level security;
alter table public.auction_carts enable row level security;
alter table public.auction_cart_items enable row level security;

drop policy if exists "catalog_is_public" on public.artworks;
create policy "catalog_is_public"
  on public.artworks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_updates_artworks" on public.artworks;
create policy "admin_updates_artworks"
  on public.artworks
  for update
  to authenticated
  using ((select public.is_basilica_admin()))
  with check ((select public.is_basilica_admin()));

drop policy if exists "admin_reads_auction_carts" on public.auction_carts;
create policy "admin_reads_auction_carts"
  on public.auction_carts
  for select
  to authenticated
  using ((select public.is_basilica_admin()));

drop policy if exists "admin_updates_auction_carts" on public.auction_carts;
create policy "admin_updates_auction_carts"
  on public.auction_carts
  for update
  to authenticated
  using ((select public.is_basilica_admin()))
  with check ((select public.is_basilica_admin()));

drop policy if exists "admin_reads_auction_cart_items" on public.auction_cart_items;
create policy "admin_reads_auction_cart_items"
  on public.auction_cart_items
  for select
  to authenticated
  using ((select public.is_basilica_admin()));
