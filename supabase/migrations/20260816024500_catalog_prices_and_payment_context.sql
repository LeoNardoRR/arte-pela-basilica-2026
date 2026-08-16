-- The supplied catalog defines only Quadro 1 as R$ 520,00.
-- Entries 2–84 contain the placeholder "R$ 00,00", so they remain pending
-- until an administrator enters the real amount.
alter table public.artworks alter column price_cents drop default;
alter table public.artworks alter column price_cents drop not null;
alter table public.artworks drop constraint if exists artworks_price_cents_check;
alter table public.artworks
  add constraint artworks_price_cents_check
  check (price_cents is null or price_cents between 100 and 100000000);

update public.artworks
set price_cents = case when id = 1 then 52000 else null end,
    updated_at = now()
where id between 1 and 84;
