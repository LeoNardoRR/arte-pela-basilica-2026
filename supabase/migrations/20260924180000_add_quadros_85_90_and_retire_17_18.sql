-- Pedido da Basílica em 24/09/2026 (Bruno Maia, via WhatsApp):
-- 1) Quadros 85-90 existiam no controle físico mas nunca entraram no catálogo
--    digital (não têm foto). O site já suporta artwork sem preço definido
--    ("Aguardando valor"), então 85 e 86 sobem como available/price null.
--    87-90 já constam vendidos no "Registro de Venda de Quadros" (R$850 cada,
--    Eliane Corral e Lala Biani) — sobem direto como sold para não permitir
--    nova reserva de uma obra já entregue.
-- 2) Quadros 17 e 18 foram extraviados. Não há registro de venda para eles
--    (linhas em branco no registro físico). Viram um novo status
--    'unavailable' — diferente de 'sold', para não sugerir que a Basílica
--    recebeu esse dinheiro. Qualquer reserva pendente para eles é encerrada
--    junto (mesmo padrão do admin_set_artwork_available).

insert into public.artworks (id, code, title, artist, technique, dimensions, status, palette, price_cents)
values
  (85, 'OB-085', 'Quadro 85', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'available', 'ocean', null),
  (86, 'OB-086', 'Quadro 86', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'available', 'morning', null),
  (87, 'OB-087', 'Quadro 87', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'sold', 'sunrise', 85000),
  (88, 'OB-088', 'Quadro 88', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'sold', 'navy', 85000),
  (89, 'OB-089', 'Quadro 89', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'sold', 'wine', 85000),
  (90, 'OB-090', 'Quadro 90', 'Artista a confirmar', 'Técnica a confirmar', 'A confirmar', 'sold', 'garden', 85000)
on conflict (id) do nothing;

with affected_carts as (
  select distinct c.id
  from public.auction_carts c
  join public.auction_cart_items ci on ci.cart_id = c.id
  where ci.artwork_id in (17, 18)
    and c.status in ('reserved', 'submitted', 'reviewed')
)
update public.auction_carts
set status = 'declined', updated_at = now()
where id in (select id from affected_carts);

update public.artworks
set status = 'unavailable', reserved_until = null, updated_at = now()
where id in (17, 18);
