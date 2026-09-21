-- Transactional communication queue for Arte pela Basílica reservations.
-- Keeps reservation capture independent from email delivery and allows retries.

create table if not exists public.reservation_email_queue (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.auction_carts(id) on delete cascade,
  message_kind text not null check (message_kind in ('buyer_confirmation', 'internal_notification')),
  recipient_email text,
  recipient_name text,
  subject text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, message_kind)
);

create index if not exists reservation_email_queue_pending_idx
  on public.reservation_email_queue (status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.reservation_email_queue enable row level security;

drop policy if exists "admin_reads_reservation_email_queue" on public.reservation_email_queue;
create policy "admin_reads_reservation_email_queue"
  on public.reservation_email_queue
  for select
  to authenticated
  using (public.is_basilica_admin());

revoke all on table public.reservation_email_queue from public, anon, authenticated;
grant select on table public.reservation_email_queue to authenticated;
grant select, insert, update, delete on table public.reservation_email_queue to service_role;

-- Evento aprovado: reservas não expiram automaticamente antes do fim do dia 22/09.
-- Reservas já abertas com prazo curto são estendidas para depois do evento.
update public.auction_carts
set expires_at = '2026-09-23 00:00:00-03'::timestamptz, updated_at = now()
where status = 'reserved'
  and (expires_at is null or expires_at < '2026-09-23 00:00:00-03'::timestamptz);

update public.artworks a
set reserved_until = '2026-09-23 00:00:00-03'::timestamptz, updated_at = now()
where a.status = 'reserved'
  and (a.reserved_until is null or a.reserved_until < '2026-09-23 00:00:00-03'::timestamptz);

create or replace function public.enqueue_pre_reservation_emails(cart_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cart record;
  works_payload jsonb;
  buyer_subject text;
  internal_subject text;
begin
  select c.id, c.bidder_name, c.bidder_email, c.bidder_phone, c.total_cents,
    c.expires_at, c.confirmation_code, c.extra_contribution_cents, c.created_at
  into cart
  from public.auction_carts c
  where c.id = enqueue_pre_reservation_emails.cart_id;

  if cart.id is null then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'artwork_id', a.id,
    'code', a.code,
    'title', a.title,
    'dimensions', a.dimensions,
    'amount_cents', ci.amount_cents
  ) order by a.code), '[]'::jsonb)
  into works_payload
  from public.auction_cart_items ci
  join public.artworks a on a.id = ci.artwork_id
  where ci.cart_id = cart.id;

  buyer_subject := 'Pré-reserva confirmada — Arte pela Basílica ' || cart.confirmation_code;
  internal_subject := 'Nova reserva de obra — ' || cart.confirmation_code;

  insert into public.reservation_email_queue (
    cart_id, message_kind, recipient_email, recipient_name, subject, payload
  ) values (
    cart.id,
    'buyer_confirmation',
    cart.bidder_email,
    cart.bidder_name,
    buyer_subject,
    jsonb_build_object(
      'confirmation_code', cart.confirmation_code,
      'bidder_name', cart.bidder_name,
      'bidder_email', cart.bidder_email,
      'bidder_phone', cart.bidder_phone,
      'total_cents', cart.total_cents,
      'extra_contribution_cents', coalesce(cart.extra_contribution_cents, 0),
      'expires_at', cart.expires_at,
      'created_at', cart.created_at,
      'works', works_payload,
      'instructions', 'Agradecemos seu apoio à Basílica Santo Antônio. A retirada da obra poderá ser feita na Basílica a partir de 23 de setembro. O pagamento será realizado diretamente com a Basílica. Apresente o código da reserva e a identificação da obra para que a secretaria possa localizar, entregar e receber o pagamento.'
    )
  ), (
    cart.id,
    'internal_notification',
    null,
    null,
    internal_subject,
    jsonb_build_object(
      'confirmation_code', cart.confirmation_code,
      'bidder_name', cart.bidder_name,
      'bidder_email', cart.bidder_email,
      'bidder_phone', cart.bidder_phone,
      'total_cents', cart.total_cents,
      'extra_contribution_cents', coalesce(cart.extra_contribution_cents, 0),
      'expires_at', cart.expires_at,
      'created_at', cart.created_at,
      'works', works_payload,
      'instructions', 'Identificar a obra reservada, acompanhar o pagamento pela secretaria e registrar a conclusão no painel administrativo.'
    )
  )
  on conflict on constraint reservation_email_queue_cart_id_message_kind_key do nothing;
end;
$$;

revoke all on function public.enqueue_pre_reservation_emails(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_pre_reservation_emails(uuid) to service_role;

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

  update public.artworks a
  set status = 'reserved', reserved_until = expires_at_value, updated_at = now()
  where a.id in (select (item ->> 'artwork_id')::bigint from jsonb_array_elements(items) item)
    and a.status = 'available';

  if not found then
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
