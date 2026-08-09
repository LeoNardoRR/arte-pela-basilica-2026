create policy "admin_reads_auction_carts"
on public.auction_carts for select to authenticated
using ((select auth.jwt() ->> 'email') = 'bmoweb@gmail.com');

create policy "admin_reads_auction_cart_items"
on public.auction_cart_items for select to authenticated
using ((select auth.jwt() ->> 'email') = 'bmoweb@gmail.com');
