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
  assert.match(supabase, /ADMIN_EMAIL\s*=\s*"ribeiroleonardoti@gmail\.com"/);
  assert.match(admin, /admin_get_proposals/);
  assert.match(admin, /admin_update_cart_status/);
  assert.match(admin, /groupByPerson/);
  assert.match(admin, /Intenções por pessoa/);
  assert.match(admin, /Fila de atendimento/);
  assert.match(admin, /statusFilters\.map/);
  assert.match(admin, /Histórico de intenções/);
  assert.match(admin, /tabIndex=\{person\.intents\.length > 2/);
  assert.match(admin, /<details className="person-card"/);
  assert.match(admin, /Ver detalhes/);
  assert.match(admin, /Contato direto/);
  assert.match(admin, /Somente o usuário autorizado e a senha fixa/);
  assert.doesNotMatch(admin, /resetPasswordForEmail|PASSWORD_RECOVERY|updateUser\(\{ password:|Criar ou redefinir senha|Visualizar demonstração|Modo demonstração|demoMode|demoIntents/);
});

test("catalog provides fixed prices, full-screen gallery and purchase-intent flow", async () => {
  const catalog = await read("app/Catalog.tsx");
  const css = await read("app/globals.css");
  assert.match(catalog, /Abrir galeria/);
  assert.match(catalog, /role="dialog" aria-modal="true" aria-labelledby="gallery-title"/);
  assert.match(catalog, /aria-label="Fechar galeria"/);
  assert.match(catalog, /focusable\[0\]\?\.focus/);
  assert.match(catalog, /modalTriggerRef\.current\.focus/);
  assert.match(catalog, /event\.key !== "Tab"/);
  assert.match(catalog, /submittingRef\.current/);
  assert.match(catalog, /phoneDigits\.length < 8/);
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
  assert.match(catalog, /useState<CatalogFilter>\("available"\)/);
  assert.match(catalog, /Disponíveis <small>\{availableCount\}<\/small>/);
  assert.match(catalog, /<ArtworkExperience3D/);
  assert.match(catalog, /CURATED_ARTWORKS/);
  assert.match(catalog, /<ArtworkPhoto work=\{work\}/);
  assert.doesNotMatch(catalog, /[→↗↑↓←]/);
  assert.match(css, /\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width:\s*1200px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width:\s*950px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.artwork-photo\s*\{[^}]*object-fit:\s*contain/);
  assert.match(css, /aspect-ratio:\s*var\(--artwork-aspect/);
  assert.match(css, /\.arrow-icon::before/);
  assert.match(css, /\.arrow-icon::before\s*\{[^}]*transform:\s*rotate\(45deg\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /position:\s*sticky;\s*top:\s*0/);
  assert.match(css, /\.mobile-catalog-link\s*\{[^}]*display:\s*none/);
});

test("all 60 catalog slots have public-domain reference art and interactive 3D", async () => {
  const images = await read("app/artworkImages.ts");
  const experience = await read("app/ArtworkExperience3D.tsx");
  assert.equal((images.match(/"slot":\s*\d+/g) ?? []).length, 60);
  assert.equal((images.match(/"license":\s*"Public Domain — The Metropolitan Museum of Art"/g) ?? []).length, 60);
  assert.equal(new Set(images.match(/"imageUrl":\s*"\/artworks\/\d{2}\.jpg"/g) ?? []).size, 60);
  assert.match(experience, /pointerdown/);
  assert.match(experience, /pointermove/);
  assert.match(experience, /touch-action:\s*pan-y|canvas\.dataset\.rotation/);
  assert.match(experience, /scrub:\s*0\.35/);
  assert.match(experience, /new THREE\.TextureLoader\(\)\.loadAsync\(reference\.imageUrl\)/);
  assert.match(experience, /frontTexture\.flipY\s*=\s*true/);
  assert.doesNotMatch(experience, /frontTexture\.rotation/);
  assert.doesNotMatch(experience, /requestAnimationFrame/);
});

test("production metadata and hosting configuration are preserved", async () => {
  const layout = await read("app/layout.tsx");
  const hosting = JSON.parse(await read(".openai/hosting.json"));
  assert.match(layout, /Arte pela Basílica/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /metadataBase/);
  assert.match(layout, /canonical/);
  assert.equal(hosting.project_id, "appgprj_6a69ecc5b8048191af285f10c3a452f8");
});

test("GitHub Pages builds the complete client application under its repository path", async () => {
  const pagesConfig = await read("vite.pages.config.ts");
  const pagesEntry = await read("github-pages/main.tsx");
  const pagesHtml = await read("github-pages/index.html");
  const workflow = await read(".github/workflows/pages.yml");
  const assets = await read("app/publicAsset.ts");
  assert.match(pagesConfig, /\/arte-pela-basilica-2026\//);
  assert.match(pagesConfig, /publicDir:\s*"\.\.\/public"/);
  assert.match(pagesEntry, /import Home from "\.\.\/app\/page"/);
  assert.match(pagesHtml, /id="root"/);
  assert.doesNotMatch(pagesHtml, /window\.location\.replace|http-equiv="refresh"/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /path:\s*dist-pages/);
  assert.match(assets, /meta\[name="public-base"\]/);
});
