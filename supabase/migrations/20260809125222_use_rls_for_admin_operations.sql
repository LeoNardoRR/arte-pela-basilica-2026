-- Run administrative RPCs as the authenticated caller and let RLS remain the
-- final authorization boundary.
revoke all on public.auction_carts from anon, authenticated;
revoke all on public.auction_cart_items from anon, authenticated;

grant select on public.auction_carts to authenticated;
grant select on public.auction_cart_items to authenticated;
grant update (status) on public.auction_carts to authenticated;
grant update (status, updated_at) on public.artworks to authenticated;

drop policy if exists "admin_updates_auction_carts" on public.auction_carts;
create policy "admin_updates_auction_carts"
on public.auction_carts for update to authenticated
using ((select public.is_basilica_admin()))
with check ((select public.is_basilica_admin()));

drop policy if exists "admin_updates_artworks" on public.artworks;
create policy "admin_updates_artworks"
on public.artworks for update to authenticated
using ((select public.is_basilica_admin()))
with check ((select public.is_basilica_admin()));

-- Contact data stays private by default. This explicit deny policy documents
-- the intent and keeps the linter from treating the table as forgotten.
drop policy if exists "reservations_are_private" on public.reservations;
create policy "reservations_are_private"
on public.reservations for select to anon, authenticated
using (false);

alter function public.admin_get_proposals() security invoker;
alter function public.admin_update_cart_status(uuid, text) security invoker;
alter function public.admin_approve_cart(uuid) security invoker;
