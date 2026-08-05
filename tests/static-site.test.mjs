import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages-ready catalog", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Arte pela Basílica/);
});
