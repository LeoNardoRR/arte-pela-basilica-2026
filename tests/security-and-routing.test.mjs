import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("admin route survives both hash navigation and auth redirect", async () => {
  const main = await read("src/main.tsx");
  assert.match(main, /hash\.startsWith\("#admin"\)/);
  assert.match(main, /searchParams|URLSearchParams/);
  assert.match(main, /access_token=/);
});

test("admin uses Supabase Auth and guarded RPCs", async () => {
  const admin = await read("src/Admin.tsx");
  assert.match(admin, /signInWithOtp/);
  assert.match(admin, /shouldCreateUser:\s*false/);
  assert.match(admin, /admin_get_proposals/);
  assert.match(admin, /admin_update_cart_status/);
  assert.match(admin, /Conta não autorizada/);
  assert.match(admin, /Modo demonstração/);
  assert.match(admin, /Nenhum dado real foi modificado/);
});

test("catalog provides an accessible carousel and sticky navigation", async () => {
  const catalog = await read("src/Catalog.tsx");
  const css = await read("src/globals.css");
  assert.match(catalog, /aria-label="Carrossel de obras"/);
  assert.match(catalog, /aria-label="Obra anterior"/);
  assert.match(catalog, /aria-label="Próxima obra"/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /position:\s*sticky;\s*top:\s*0/);
});

test("database migration closes anonymous admin access", async () => {
  const migration = await read("supabase/migrations/20260809124403_harden_admin_workflow.sql");
  assert.match(migration, /revoke all on function public\.admin_get_proposals\(\) from public, anon/);
  assert.match(migration, /revoke all on function public\.admin_update_cart_status\(uuid, text\) from public, anon/);
  assert.match(migration, /revoke all on function public\.reserve_artwork[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /clean_email !~\*/);
});

test("admin mutations run with RLS as the authenticated caller", async () => {
  const migration = await read("supabase/migrations/20260809125222_use_rls_for_admin_operations.sql");
  assert.match(migration, /admin_updates_auction_carts/);
  assert.match(migration, /admin_updates_artworks/);
  assert.match(migration, /admin_get_proposals\(\) security invoker/);
  assert.match(migration, /admin_update_cart_status\(uuid, text\) security invoker/);
});

test("catalog never falls back to stale works when the API fails", async () => {
  const catalog = await read("src/Catalog.tsx");
  assert.doesNotMatch(catalog, /fallbackWorks/);
  assert.match(catalog, /Não foi possível carregar o acervo/);
  assert.match(catalog, /Uma das obras não está mais disponível/);
  assert.match(catalog, /Nenhuma obra foi reservada ou cobrada/);
});
