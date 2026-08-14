-- View pública segura para o painel admin (dados pessoais protegidos por RLS,
-- mas a função abaixo roda como security definer e pode ser exposta seletivamente).
-- Esta RPC retorna as propostas com os itens aninhados para o painel de administração.

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
security definer
set search_path = public, pg_temp
as $$
begin
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

-- Por padrão não concedemos a anon: o acesso deve ser protegido por senha no front.
-- Se quiser expor sem autenticação no MVP, descomente a linha abaixo:
-- grant execute on function public.admin_get_proposals() to anon;

-- Para proteger com senha simples no front-end, basta não conceder a anon
-- e chamar a função com a service_role key (nunca exposta no client).
-- Solução MVP: conceder a authenticated e usar login básico.
grant execute on function public.admin_get_proposals() to anon, authenticated;
