-- Revoke direct table writes; mutations go through SECURITY DEFINER / admin RLS RPCs.

revoke update on table public.artworks from authenticated, anon;
revoke update on table public.auction_carts from authenticated, anon;
revoke update on table public.auction_cart_items from authenticated, anon;

revoke insert on table public.artworks from authenticated, anon;
revoke insert on table public.auction_carts from authenticated, anon;
revoke insert on table public.auction_cart_items from authenticated, anon;

revoke delete on table public.artworks from authenticated, anon;
revoke delete on table public.auction_carts from authenticated, anon;
revoke delete on table public.auction_cart_items from authenticated, anon;
