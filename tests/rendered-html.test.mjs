import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("admin route survives hash navigation and auth redirects", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /hash\.startsWith\("#admin"\)/);
  assert.match(page, /URLSearchParams/);
  assert.match(page, /access_token=/);
  assert.match(page, /hashchange/);
});

test("admin uses protected Supabase access and includes a safe demo", async () => {
  const admin = await read("app/Admin.tsx");
  assert.match(admin, /signInWithOtp/);
  assert.match(admin, /shouldCreateUser:\s*false/);
  assert.match(admin, /admin_get_proposals/);
  assert.match(admin, /admin_update_cart_status/);
  assert.match(admin, /Modo demonstração/);
  assert.match(admin, /Nenhum dado real foi modificado/);
});

test("catalog provides an expandable full-screen gallery and bidding flow", async () => {
  const catalog = await read("app/Catalog.tsx");
  const css = await read("app/globals.css");
  assert.match(catalog, /Abrir galeria de obras/);
  assert.match(catalog, /role="dialog" aria-modal="true" aria-labelledby="gallery-title"/);
  assert.match(catalog, /aria-label="Fechar galeria"/);
  assert.match(catalog, /galleryCloseRef\.current\?\.focus/);
  assert.match(catalog, /mobile-catalog-link/);
  assert.match(catalog, /submit_auction_cart/);
  assert.match(catalog, /Minha sacola de lances/);
  assert.match(catalog, /Nenhuma obra foi reservada ou cobrada/);
  assert.doesNotMatch(catalog, /fallbackWorks/);
  assert.match(css, /\.gallery-overlay\s*\{[^}]*position:\s*fixed/);
  assert.match(catalog, /gallery-remainder-/);
  assert.match(catalog, /IntersectionObserver/);
  assert.match(catalog, /requestAnimationFrame/);
  assert.match(css, /\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(12/);
  assert.match(css, /nth-child\(5n\+1\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /position:\s*sticky;\s*top:\s*0/);
  assert.match(css, /\.mobile-catalog-link\s*\{[^}]*display:\s*none/);
});

test("production metadata and hosting configuration are preserved", async () => {
  const layout = await read("app/layout.tsx");
  const hosting = JSON.parse(await read(".openai/hosting.json"));
  assert.match(layout, /Arte pela Basílica/);
  assert.match(layout, /og\.png/);
  assert.equal(hosting.project_id, "appgprj_6a69ecc5b8048191af285f10c3a452f8");
});
