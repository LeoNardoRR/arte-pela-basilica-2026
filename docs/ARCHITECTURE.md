# Arquitetura — Arte pela Basílica 2026

Documentação de referência para quem entra no projeto. O README cobre setup; aqui ficam decisões e fluxos.

## Ambientes

| Superfície | Build | Deploy | Quem acessa |
|------------|-------|--------|-------------|
| Catálogo público | `npm run build:pages` | GitHub Pages (`pages.yml`) | Visitantes |
| Painel admin | `npm run build` (Vinext) | OpenAI Sites / Worker | Equipe com `basilica_admin` |

Os dois apontam para o **mesmo projeto Supabase**. Só a chave publishable vai no bundle do catálogo.

## Fluxo do visitante

```text
Catalog.tsx
  → SELECT artworks (RLS: catalog_is_public)
  → submit_pre_reservation (RPC, SECURITY DEFINER)
       → release_expired_pre_reservations (interno)
       → INSERT auction_carts + auction_cart_items
       → UPDATE artworks (reserved + reserved_until)
```

Pré-reserva não cobra online. O prazo (`hold_minutes`) vem do formulário: 30 min no evento, 24 h na Basílica.

## Fluxo administrativo

```text
/#admin
  → Supabase Auth (sessão em memória, persistSession: false)
  → is_basilica_admin() via app_metadata.basilica_admin
  → RPCs admin_* (SECURITY INVOKER + checagem no corpo)
```

Status de intenção: `reserved` → `reviewed` → `approved` → `paid` (ou `declined` / `expired`).

## Banco de dados

Migrações em [`supabase/migrations/`](../supabase/migrations/), em ordem de timestamp.

| Migração | Papel |
|----------|--------|
| `20260831233000_soc_hardening.sql` | Auth admin, `submit_pre_reservation`, revoke de RPCs legadas |
| `20260901100000_revoke_direct_table_updates.sql` | Remove UPDATE direto em tabelas |
| `20260901101000_rls_policies.sql` | RLS alinhado à produção |
| `20260901110000_operational_rpcs.sql` | `release_expired_pre_reservations`, `admin_update_cart_status` |

Aplicar com `supabase db push` (workflow `supabase-migrations.yml`, disparo manual) ou SQL Editor.

**Importante:** em produção, parte do schema foi criada antes do versionamento completo. Em ambiente novo, rodar todas as migrações em ordem. Se algo já existir, `CREATE OR REPLACE` e `IF NOT EXISTS` evitam quebra.

## Segurança (resumo)

- PII só via RPC admin autenticada; `admin_get_proposals` sem grant para `anon`
- Admin identificado por `app_metadata.basilica_admin`, não por e-mail no código
- Carrinho do visitante em `sessionStorage`; protocolo de reserva não persiste em `localStorage`
- D1 / API legada removidos do repositório

## Variáveis de ambiente

```bash
cp .env.example .env.local
```

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Cliente Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave publishable |

No CI (`pages.yml`), os secrets homônimos são opcionais — há fallback no código para o projeto atual.

Para testes de integração:

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:integration
```

## Testes

```bash
npm test                 # build Vinext + regressão estática
npm run test:integration # RPCs no Supabase remoto (requer env)
npm run lint
npm run build:pages      # artefato do GitHub Pages
```

## O que não entra em produção

- `temp/` — rascunhos locais (ignorado pelo git)
- Stack D1/Drizzle e pasta `src/` legada — removidos
