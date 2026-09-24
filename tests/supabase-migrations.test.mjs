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
  assert.match(sql, /release_expired_pre_reservations/);
  assert.match(sql, /admin_update_cart_status/);
  assert.match(sql, /reservation_email_queue/);
  assert.match(sql, /enqueue_pre_reservation_emails/);
  assert.match(sql, /buyer_confirmation/);
  assert.match(sql, /internal_notification/);
  assert.match(sql, /pagamento e a retirada da obra são feitos na secretaria da Basílica/i);
  assert.match(sql, /2026-09-23 00:00:00-03/);
  assert.match(sql, /is_basilica_admin\(\)/);
});
