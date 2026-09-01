import assert from "node:assert/strict";
import test from "node:test";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

test("admin_get_proposals rejects anonymous calls", { skip: !url || !key }, async () => {
  const response = await fetch(`${url}/rest/v1/rpc/admin_get_proposals`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });

  assert.notEqual(response.status, 200);
});

test("public catalog remains readable", { skip: !url || !key }, async () => {
  const response = await fetch(`${url}/rest/v1/artworks?select=id,code&limit=1`, {
    headers: { apikey: key },
  });

  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.ok(Array.isArray(rows));
});
