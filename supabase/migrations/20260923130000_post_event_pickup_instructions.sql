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
      'instructions', 'Agradecemos seu apoio à Basílica Santo Antônio. Para reservas realizadas pelo site a partir de 23 de setembro, o pagamento e a retirada da obra são feitos na secretaria da Basílica. Apresente o código da reserva e a identificação da obra para que a equipe possa localizar sua compra.'
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
      'instructions', 'Reserva feita pelo site: identificar a obra, receber o pagamento e realizar a retirada na secretaria da Basílica. Depois, registrar a conclusão no painel administrativo.'
    )
  )
  on conflict on constraint reservation_email_queue_cart_id_message_kind_key do nothing;
end;
$$;
