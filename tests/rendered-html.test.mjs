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

test("admin uses protected Supabase access and has no public demo", async () => {
  const admin = await read("app/Admin.tsx");
  const supabase = await read("app/supabase.ts");
  assert.match(admin, /signInWithPassword/);
  assert.match(admin, /resetPasswordForEmail/);
  assert.match(admin, /PASSWORD_RECOVERY/);
  assert.match(admin, /updateUser\(\{ password:/);
  assert.match(supabase, /ADMIN_EMAIL\s*=\s*"ribeiroleonardoti@gmail\.com"/);
  assert.match(admin, /admin_get_proposals/);
  assert.match(admin, /admin_update_cart_status/);
  assert.match(admin, /groupByPerson/);
  assert.match(admin, /Intenções por pessoa/);
  assert.match(admin, /resetCooldown/);
  assert.doesNotMatch(admin, /Visualizar demonstração|Modo demonstração|demoMode|demoIntents/);
});

test("catalog provides fixed prices, full-screen gallery and purchase-intent flow", async () => {
  const catalog = await read("app/Catalog.tsx");
  const css = await read("app/globals.css");
  assert.match(catalog, /Abrir galeria/);
  assert.match(catalog, /role="dialog" aria-modal="true" aria-labelledby="gallery-title"/);
  assert.match(catalog, /aria-label="Fechar galeria"/);
  assert.match(catalog, /galleryCloseRef\.current\?\.focus/);
  assert.match(catalog, /mobile-catalog-link/);
  assert.match(catalog, /className="admin-menu-link" href="#admin"/);
  assert.match(catalog, /price_cents/);
  assert.match(catalog, /submit_purchase_intent/);
  assert.match(catalog, /Intenção de compra/);
  assert.match(catalog, /Sem pagamento online/);
  assert.doesNotMatch(catalog, /updateAmount|MAX_BID|type="number"/);
  assert.doesNotMatch(catalog, /fallbackWorks/);
  assert.match(css, /\.gallery-overlay\s*\{[^}]*position:\s*fixed/);
  assert.match(catalog, /IntersectionObserver/);
  assert.match(catalog, /requestAnimationFrame/);
  assert.match(css, /\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5/);
  assert.match(css, /@media \(max-width:\s*1200px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /@media \(max-width:\s*950px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
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
