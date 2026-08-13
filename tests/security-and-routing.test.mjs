import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("admin route survives hash navigation and auth redirects", async () => {
  const main = await read("src/main.tsx");
  assert.match(main, /hash\.startsWith\("#admin"\)/);
  assert.match(main, /URLSearchParams/);
  assert.match(main, /access_token=/);
});

test("admin uses authenticated, guarded operations", async () => {
  const admin = await read("src/Admin.tsx");
  assert.match(admin, /signInWithPassword/);
  assert.match(admin, /admin_get_proposals/);
  assert.match(admin, /admin_update_cart_status/);
  assert.match(admin, /Conta não autorizada/);
  assert.match(admin, /window\.confirm/);
  assert.doesNotMatch(admin, /demoIntentsSeed|Modo demonstração/);
});

test("catalog has accessible dialogs, skip navigation and reduced-motion support", async () => {
  const catalog = await read("src/Catalog.tsx");
  const css = await read("src/globals.css");
  assert.match(catalog, /className="skip-link"/);
  assert.match(catalog, /role="dialog"/);
  assert.match(catalog, /aria-modal="true"/);
  assert.match(catalog, /prefers-reduced-motion/);
  assert.match(catalog, /trapFocus/);
  assert.match(catalog, /\.inert = true/);
  assert.match(catalog, /fetchPriority="high"/);
  assert.doesNotMatch(catalog, /className="brand"[^>]*aria-label/);
  assert.match(catalog, /aria-label="Administrativo"/);
  assert.match(catalog, /srcSet=\{HERO_IMAGE_SET\}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("purchase flow uses fixed database prices and protects against duplicate submissions", async () => {
  const catalog = await read("src/Catalog.tsx");
  assert.match(catalog, /select\("id,code,title,artist,technique,dimensions,status,palette,price_cents"\)/);
  assert.match(catalog, /submit_purchase_intent/);
  assert.match(catalog, /submittingRef\.current/);
  assert.match(catalog, /useState<CartItem\[\]>\(loadSavedCart\)/);
  assert.match(catalog, /phoneDigits\.length < 8/);
  assert.match(catalog, /message && <div className="success-message error-message" role="alert">/);
  assert.match(catalog, /Nenhuma cobrança foi realizada/);
  assert.doesNotMatch(catalog, /MAX_BID|amount:\s*number/);
});

test("database migrations enforce fixed prices, phone validation and RLS-backed admin writes", async () => {
  const prices = await read("supabase/migrations/20260813130000_fixed_artwork_prices_and_purchase_intents.sql");
  const hardening = await read("supabase/migrations/20260813142540_grant_admin_updates_and_validate_phone.sql");
  const rls = await read("supabase/migrations/20260809125222_use_rls_for_admin_operations.sql");
  assert.match(prices, /price_cents/);
  assert.match(prices, /submit_purchase_intent/);
  assert.match(hardening, /phone_digits text := regexp_replace[\s\S]*'\[\^0-9\]'[\s\S]*'g'/);
  assert.match(hardening, /grant update on table public\.artworks to authenticated/);
  assert.match(rls, /admin_updates_auction_carts/);
  assert.match(rls, /admin_updates_artworks/);
});

test("catalog never fabricates works when the API fails", async () => {
  const catalog = await read("src/Catalog.tsx");
  assert.doesNotMatch(catalog, /fallbackWorks/);
  assert.match(catalog, /Não foi possível carregar o acervo/);
  assert.match(catalog, /Uma das obras não está mais disponível/);
});

test("temporary Pages environment has explicit social metadata, noindex and a real 404", async () => {
  const index = await read("index.html");
  const robots = await read("public/robots.txt");
  const notFound = await read("public/404.html");
  assert.match(index, /name="robots" content="noindex,follow"/);
  assert.match(index, /property="og:image" content="https:\/\/leonardorr\.github\.io\/arte-pela-basilica-2026\/og\.png"/);
  assert.match(index, /rel="canonical"/);
  assert.match(index, /rel="preload" as="image"/);
  assert.match(robots, /Disallow: \//);
  assert.match(notFound, /Página não encontrada/);
  assert.match(notFound, /\/arte-pela-basilica-2026\//);
});
