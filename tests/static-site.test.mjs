import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages-ready catalog", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Arte pela Basílica/);
  assert.match(html, /assets\/index-/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /og\.png/);
  assert.match(html, /<noscript>/);
  await access(new URL("../dist/404.html", import.meta.url));
  await access(new URL("../dist/robots.txt", import.meta.url));
  await access(new URL("../dist/hero-basilica-v3.webp", import.meta.url));
  await access(new URL("../dist/hero-basilica-640.webp", import.meta.url));
  await access(new URL("../dist/hero-basilica-1200.webp", import.meta.url));
  await access(new URL("../dist/logo-basilica.webp", import.meta.url));
});
