import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

test("migrations version revoke grants and RLS policies", async () => {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql"));
  const sql = await Promise.all(
    files.map((name) => readFile(new URL(name, migrationsDir), "utf8")),
  ).then((chunks) => chunks.join("\n"));

  assert.match(sql, /revoke update on table public\.artworks from authenticated, anon/);
  assert.match(sql, /catalog_is_public/);
  assert.match(sql, /admin_reads_auction_carts/);
  assert.match(sql, /submit_pre_reservation/);
});
