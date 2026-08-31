-- A consulta administrativa roda com as permissões do usuário autenticado.

create or replace function public.admin_get_proposals()
returns table (
  id          uuid,
  bidder_name text,
  bidder_email text,
  bidder_phone text,
  preferred_payment_method text,
  total_cents integer,
  status      text,
  created_at  timestamptz,
  items       jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select public.is_basilica_admin()) then
    raise exception 'Acesso administrativo não autorizado.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.bidder_name,
    c.bidder_email,
    c.bidder_phone,
    c.preferred_payment_method,
    c.total_cents,
    c.status,
    c.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'artwork_id',    ci.artwork_id,
          'artwork_code',  a.code,
          'artwork_title', a.title,
          'amount_cents',  ci.amount_cents
        )
        order by a.code
      ) filter (where ci.artwork_id is not null),
      '[]'::jsonb
    ) as items
  from public.auction_carts c
  left join public.auction_cart_items ci on ci.cart_id = c.id
  left join public.artworks a on a.id = ci.artwork_id
  group by c.id
  order by c.created_at desc;
end;
$$;

revoke all on function public.admin_get_proposals() from public, anon;
grant execute on function public.admin_get_proposals() to authenticated, service_role;
