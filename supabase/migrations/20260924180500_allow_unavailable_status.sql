-- artworks_status_check só aceitava available/reserved/sold. Quadro extraviado
-- (17, 18) precisa do status 'unavailable' criado no commit anterior.
alter table public.artworks drop constraint if exists artworks_status_check;
alter table public.artworks add constraint artworks_status_check
  check (status in ('available', 'reserved', 'sold', 'unavailable'));
