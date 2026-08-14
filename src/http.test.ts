import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Fleet } from "./fleet.js";
import { createApp } from "./http.js";
import { Store } from "./store.js";

test("cron GET /api/scan-all needs the bearer secret when the board has a password", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const app = createApp(new Fleet(store), "board", "cron-secret");

  const blocked = await app.request("/api/scan-all");
  assert.equal(blocked.status, 401);

  const wrong = await app.request("/api/scan-all", { headers: { authorization: "Bearer no" } });
  assert.equal(wrong.status, 401);

  const other = await app.request("/api/sites", { headers: { authorization: "Bearer cron-secret" } });
  assert.equal(other.status, 401);

  const cron = await app.request("/api/scan-all", { headers: { authorization: "Bearer cron-secret" } });
  assert.equal(cron.status, 200);
  assert.deepEqual(await cron.json(), { started: 0 });

  const cookie = await app.request("/api/scan-all", {
    method: "POST",
    headers: { cookie: "watch=board" },
  });
  assert.equal(cookie.status, 200);
  assert.deepEqual(await cookie.json(), { started: 0 });
  await store.close();
});

test("scan-all returns 200 in Node where Hono has no ExecutionContext", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const fleet = new Fleet(store, {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    },
  });
  await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa",
  });
  const app = createApp(fleet);
  const response = await app.request("/api/scan-all");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { started: 1 });
  for (let i = 0; i < 50; i += 1) {
    const row = (await fleet.overview())[0];
    if (row && !row.running && row.latest) {
      await store.close();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await store.close();
  throw new Error("scan did not finish");
});
