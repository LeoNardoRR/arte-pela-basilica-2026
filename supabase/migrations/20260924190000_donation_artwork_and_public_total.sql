-- Pedido da Basílica em 24/09/2026: um "quadro de doação" com valor livre,
-- estipulado pela pessoa, e um total arrecadado público no site.
--
-- A doação usa o mesmo fluxo de pré-reserva dos quadros (nome, e-mail,
-- WhatsApp, código de confirmação), mas com duas diferenças de propósito:
--   1) preço livre: a linha não tem price_cents fixo — o valor inteiro da
--      doação vem do campo "oferta adicional" que o carrinho já suportava
--      para acréscimos voluntários sobre uma obra. Isso evita reabrir a
--      regra de segurança que rejeita preço vindo do navegador: o preço
--      por item continua sempre vindo do banco, só que aqui ele é nulo.
--   2) nunca fica "reserved": ao contrário de um quadro físico (1 por vez),
--      qualquer número de pessoas pode doar. O id 9000 é explicitamente
--      excluído da trava de disponibilidade dentro de submit_pre_reservation.
--
-- id 9000 é proposital: fora da faixa 1-90 dos quadros físicos, para nunca
-- ser confundido com um número de retirada na Basílica.

insert into public.artworks (id, code, title, artist, technique, dimensions, status, palette, price_cents)
values (9000, 'DOACAO', 'Doação livre', 'Basílica Santo Antônio de Pádua', 'Contribuição livre', 'Sem valor fixo', 'available', 'night', null)
on conflict (id) do nothing;

create or replace function public.submit_pre_reservation(
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  items jsonb,
  extra_contribution_cents integer default 0,
  hold_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_cart_id uuid;
  item_count integer;
  distinct_item_count integer;
  available_count integer;
  recent_request_count integer;
  calculated_total bigint;
  expires_at_value timestamptz;
  confirmation_code_value text;
  clean_name text := btrim(coalesce(bidder_name, ''));
  clean_email text := lower(btrim(coalesce(bidder_email, '')));
  clean_phone text := btrim(coalesce(bidder_phone, ''));
  phone_digits text := regexp_replace(btrim(coalesce(bidder_phone, '')), '[^0-9]', '', 'g');
begin
  -- Não liberamos reservas automaticamente antes do evento; a equipe decide no painel.
  if char_length(clean_name) not between 2 and 120
    or char_length(clean_email) not between 5 and 160
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(clean_phone) not between 8 and 40
    or char_length(phone_digits) not between 8 and 15 then
    raise exception 'Preencha nome, e-mail e WhatsApp corretamente.' using errcode = '22023';
  end if;

  if items is null or jsonb_typeof(items) <> 'array'
    or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'A seleção deve ter entre 1 e 20 obras.' using errcode = '22023';
  end if;

  if coalesce(extra_contribution_cents, 0) < 0 or coalesce(extra_contribution_cents, 0) > 100000000 then
    raise exception 'O valor da contribuição adicional é inválido.' using errcode = '22023';
  end if;

  if hold_minutes < 10 or hold_minutes > 1440 then
    raise exception 'O tempo de pré-reserva é inválido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(items) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'artwork_id', '') !~ '^[0-9]+$'
      or item ? 'amount_cents'
  ) then
    raise exception 'A seleção contém dados inválidos.' using errcode = '22023';
  end if;

  select count(*), count(distinct (item ->> 'artwork_id')::bigint)
  into item_count, distinct_item_count
  from jsonb_array_elements(items) item;

  if item_count <> distinct_item_count then
    raise exception 'Uma obra não pode aparecer duas vezes na mesma seleção.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clean_email || ':' || phone_digits, 0));
  select count(*) into recent_request_count
  from public.auction_carts c
  where c.created_at >= now() - interval '1 hour'
    and (lower(c.bidder_email) = clean_email
      or regexp_replace(c.bidder_phone, '[^0-9]', '', 'g') = phone_digits);
  if recent_request_count >= 5 then
    raise exception 'Limite temporário de pré-reservas atingido. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;

  perform 1
  from public.artworks a
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item)
  order by a.id
  for update;

  select count(*), coalesce(sum(a.price_cents), 0)
  into available_count, calculated_total
  from public.artworks a
  where a.status = 'available'
    and a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item);

  if available_count <> item_count then
    raise exception 'Uma ou mais obras acabaram de ser pré-reservadas ou adquiridas.' using errcode = 'P0001';
  end if;

  calculated_total := calculated_total + coalesce(extra_contribution_cents, 0);
  if calculated_total < 100 or calculated_total > 2000000000 then
    raise exception 'O valor total da seleção é inválido.' using errcode = '22023';
  end if;

  expires_at_value := greatest(now() + make_interval(mins => hold_minutes), '2026-09-23 00:00:00-03'::timestamptz);
  confirmation_code_value := 'BAS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.auction_carts (
    bidder_name, bidder_email, bidder_phone, preferred_payment_method,
    total_cents, status, expires_at, extra_contribution_cents, confirmation_code
  ) values (
    clean_name, clean_email, clean_phone, 'in_person',
    calculated_total::integer, 'reserved', expires_at_value,
    coalesce(extra_contribution_cents, 0), confirmation_code_value
  ) returning id into new_cart_id;

  insert into public.auction_cart_items (cart_id, artwork_id, amount_cents)
  select new_cart_id, a.id, a.price_cents
  from public.artworks a
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item);

  -- A doação (id 9000) nunca trava: diferente de um quadro físico, qualquer
  -- número de pessoas pode doar ao mesmo tempo, então ela fica de fora
  -- desta atualização e continua 'available' para o próximo doador.
  update public.artworks a
  set status = 'reserved', reserved_until = expires_at_value, updated_at = now()
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item)
    and a.id <> 9000
    and a.status = 'available';

  if not found and not (
    select bool_and((item ->> 'artwork_id')::bigint = 9000)
    from jsonb_array_elements(items) item
  ) then
    raise exception 'Não foi possível concluir a pré-reserva.' using errcode = 'P0001';
  end if;

  perform public.enqueue_pre_reservation_emails(new_cart_id);

  return jsonb_build_object(
    'reservation_id', new_cart_id,
    'confirmation_code', confirmation_code_value,
    'expires_at', expires_at_value,
    'base_total_cents', calculated_total - coalesce(extra_contribution_cents, 0),
    'extra_contribution_cents', coalesce(extra_contribution_cents, 0),
    'total_cents', calculated_total
  );
end;
$$;

revoke all on function public.submit_pre_reservation(text, text, text, jsonb, integer, integer) from public;
grant execute on function public.submit_pre_reservation(text, text, text, jsonb, integer, integer) to anon, authenticated, service_role;

-- Total arrecadado, para exibição pública no site. Só devolve uma soma —
-- nenhuma linha de auction_carts (com nome/e-mail/telefone) é exposta.
create or replace function public.get_total_raised_cents()
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(total_cents), 0)::bigint
  from public.auction_carts
  where status = 'paid';
$$;

revoke all on function public.get_total_raised_cents() from public;
grant execute on function public.get_total_raised_cents() to anon, authenticated, service_role;
