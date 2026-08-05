create table public.artworks (
  id bigint primary key,
  code text not null unique,
  title text not null,
  artist text not null,
  technique text not null,
  dimensions text not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  palette text not null,
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id bigint generated always as identity primary key,
  artwork_id bigint not null references public.artworks(id),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 160),
  phone text not null check (char_length(phone) between 5 and 40),
  status text not null default 'pending' check (status in ('pending', 'contacted', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index reservations_artwork_id_idx on public.reservations (artwork_id);
create index reservations_created_at_idx on public.reservations (created_at desc);

alter table public.artworks enable row level security;
alter table public.reservations enable row level security;
revoke all on public.artworks from anon, authenticated;
revoke all on public.reservations from anon, authenticated;
grant select on public.artworks to anon, authenticated;
create policy "catalog_is_public" on public.artworks for select to anon, authenticated using (true);

insert into public.artworks (id, code, title, artist, technique, dimensions, status, palette) values
(1, 'OB-001', 'Luz da manhã', 'Artista a confirmar', 'Óleo sobre tela', '80 × 60 cm', 'available', 'sunrise'),
(2, 'OB-002', 'Caminho de fé', 'Artista a confirmar', 'Técnica mista', '70 × 50 cm', 'available', 'navy'),
(3, 'OB-003', 'Santo silêncio', 'Artista a confirmar', 'Acrílica sobre tela', '90 × 70 cm', 'reserved', 'wine'),
(4, 'OB-004', 'Jardim interior', 'Artista a confirmar', 'Óleo sobre tela', '60 × 60 cm', 'available', 'garden'),
(5, 'OB-005', 'Entre arcos', 'Artista a confirmar', 'Técnica mista', '100 × 70 cm', 'sold', 'arches'),
(6, 'OB-006', 'Vigília', 'Artista a confirmar', 'Acrílica sobre tela', '80 × 80 cm', 'available', 'night');

create or replace function public.reserve_artwork(
  artwork_id bigint,
  reserver_name text,
  reserver_email text,
  reserver_phone text
)
returns setof public.artworks
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_artwork public.artworks%rowtype;
  clean_name text := btrim(reserver_name);
  clean_email text := lower(btrim(reserver_email));
  clean_phone text := btrim(reserver_phone);
begin
  if char_length(clean_name) < 2 or char_length(clean_name) > 120
    or char_length(clean_email) < 3 or char_length(clean_email) > 160
    or position('@' in clean_email) < 2
    or char_length(clean_phone) < 5 or char_length(clean_phone) > 40 then
    raise exception 'Preencha nome, e-mail e WhatsApp corretamente.' using errcode = '22023';
  end if;

  update public.artworks
  set status = 'reserved', updated_at = now()
  where id = artwork_id and status = 'available'
  returning * into reserved_artwork;

  if not found then
    raise exception 'Esta obra acabou de ser reservada ou adquirida.' using errcode = 'P0001';
  end if;

  insert into public.reservations (artwork_id, name, email, phone)
  values (artwork_id, clean_name, clean_email, clean_phone);
  return next reserved_artwork;
end;
$$;

revoke all on function public.reserve_artwork(bigint, text, text, text) from public;
grant execute on function public.reserve_artwork(bigint, text, text, text) to anon, authenticated;
