-- Complements the timed pre-reservation migrations already installed in production.
-- Catalog titles/dimensions come from "SEGUNDA VER. - Catálogo Vernissage".
do $$
declare
  dimensions text[] := array[
    '86 × 75 cm','86 × 75 cm','86 × 75 cm','50 × 36 cm','50 × 36 cm','50 × 36 cm','A confirmar','87 × 72 cm','61 × 70 cm','61 × 70 cm',
    '50 × 42 cm','50 × 42 cm','50 × 42 cm','50 × 42 cm','32 × 25 cm','32 × 25 cm','32 × 25 cm','32 × 25 cm','86 × 75 cm','86 × 75 cm',
    '62 × 54 cm','62 × 54 cm','62 × 54 cm','62 × 54 cm','62 × 54 cm','62 × 54 cm','37 × 44 cm','37 × 44 cm','37 × 44 cm','37 × 44 cm',
    '29 × 38 cm','29 × 38 cm','29 × 38 cm','47 × 40 cm','47 × 40 cm','47 × 40 cm','47 × 38 cm','47 × 38 cm','47 × 38 cm','47 × 38 cm',
    '47 × 38 cm','47 × 38 cm','42 × 32 cm','42 × 32 cm','42 × 32 cm','42 × 32 cm','42 × 32 cm','42 × 32 cm','45 × 53 cm','45 × 53 cm',
    '45 × 53 cm','45 × 53 cm','30 × 34 cm','30 × 34 cm','30 × 34 cm','44 × 50 cm','44 × 50 cm','43 × 51 cm','43 × 51 cm','55 × 67 cm',
    '55 × 67 cm','50 × 50 cm','50 × 50 cm','50 × 50 cm','40 × 50 cm','35 × 37 cm','35 × 37 cm','58 × 46 cm','58 × 46 cm','86 × 107 cm',
    '42 × 46 cm','42 × 46 cm','38 × 45 cm','38 × 45 cm','38 × 45 cm','38 × 45 cm','38 × 45 cm','38 × 45 cm','38 × 45 cm','26 × 35 cm',
    '26 × 35 cm','40 × 50 cm','38 × 45 cm','98 × 78 cm'
  ];
  artwork_number integer;
begin
  for artwork_number in 1..84 loop
    insert into public.artworks (id, code, title, artist, technique, dimensions, status, palette, price_cents, updated_at)
    values (
      artwork_number,
      'OB-' || lpad(artwork_number::text, 3, '0'),
      'Quadro ' || artwork_number,
      'Artista a confirmar',
      'Técnica a confirmar',
      dimensions[artwork_number],
      'available',
      case (artwork_number - 1) % 6 when 0 then 'sunrise' when 1 then 'navy' when 2 then 'wine' when 3 then 'garden' when 4 then 'arches' else 'night' end,
      case when artwork_number = 1 then 52000 else 3000000 end,
      now()
    )
    on conflict (id) do update set
      code = excluded.code,
      title = excluded.title,
      artist = excluded.artist,
      technique = excluded.technique,
      dimensions = excluded.dimensions,
      price_cents = excluded.price_cents,
      updated_at = now();
  end loop;
end $$;

create or replace function public.admin_update_artwork_price(artwork_id bigint, new_price_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_basilica_admin() then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if new_price_cents is null or new_price_cents not between 100 and 100000000 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  update public.artworks set price_cents = new_price_cents, updated_at = now() where id = artwork_id;
end;
$$;

revoke all on function public.admin_update_artwork_price(bigint, integer) from public;
grant execute on function public.admin_update_artwork_price(bigint, integer) to authenticated;
