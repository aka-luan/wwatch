import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Fleet } from "./fleet.js";
import { createApp, SESSION_TTL_MS, sessionToken } from "./http.js";
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

  const session = await loginCookie(app, "board");
  assert.notEqual(decodeURIComponent(session.slice("watch=".length)), "board");

  const cookieGet = await app.request("/api/scan-all", { headers: { cookie: session } });
  assert.equal(cookieGet.status, 401);

  const cookie = await app.request("/api/scan-all", {
    method: "POST",
    headers: { cookie: session },
  });
  assert.equal(cookie.status, 200);
  assert.deepEqual(await cookie.json(), { started: 0 });
  await store.close();
});

test("login rejects a password cookie and rate-limits failures", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const app = createApp(new Fleet(store), "board", "cron-secret");

  const stolen = await app.request("/api/sites", { headers: { cookie: "watch=board" } });
  assert.equal(stolen.status, 401);

  const badJson = await app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  assert.equal(badJson.status, 401);

  for (let i = 0; i < 10; i += 1) {
    const fail = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ password: "nope" }),
    });
    assert.equal(fail.status, 401);
  }
  const locked = await app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ password: "board" }),
  });
  assert.equal(locked.status, 429);
  await store.close();
});

test("logout clears the cookie and an expired session is rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const app = createApp(new Fleet(store), "board");
  const session = await loginCookie(app, "board");

  const out = await app.request("/api/logout", { method: "POST", headers: { cookie: session } });
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie") ?? "", /Max-Age=0/);

  const expired = sessionToken("board", Date.now() - SESSION_TTL_MS - 1000);
  const denied = await app.request("/api/sites", { headers: { cookie: `watch=${expired}` } });
  assert.equal(denied.status, 401);

  const ok = await app.request("/api/sites", { headers: { cookie: session } });
  assert.equal(ok.status, 200);
  await store.close();
});

test("PATCH /api/sites/:id updates the name and rejects a bad password", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  let allow = true;
  const fleet = new Fleet(store, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
      }
      if (!allow) {
        return new Response("no", { status: 401 });
      }
      return new Response("[]", { status: 200 });
    },
  });
  const site = await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa",
  });
  const app = createApp(fleet, "board");
  const session = await loginCookie(app, "board");

  const renamed = await app.request(`/api/sites/${site.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: session },
    body: JSON.stringify({ name: "Shop" }),
  });
  assert.equal(renamed.status, 200);
  assert.equal(((await renamed.json()) as { name: string }).name, "Shop");

  const page = await app.request(`/api/sites/${site.id}`, { headers: { cookie: session } });
  const body = (await page.json()) as { username: string; history: unknown[] };
  assert.equal(body.username, "luan");
  assert.ok(Array.isArray(body.history));

  allow = false;
  const rejected = await app.request(`/api/sites/${site.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: session },
    body: JSON.stringify({ applicationPassword: "nope" }),
  });
  assert.equal(rejected.status, 400);
  await store.close();
});

test("login lockout is shared across app instances on the same database", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const path = join(dir, "watch.db");
  const store = new Store(path);
  const app = createApp(new Fleet(store), "board");
  for (let i = 0; i < 10; i += 1) {
    const fail = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ password: "nope" }),
    });
    assert.equal(fail.status, 401);
  }
  await store.close();

  const again = new Store(path);
  const app2 = createApp(new Fleet(again), "board");
  const locked = await app2.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ password: "board" }),
  });
  assert.equal(locked.status, 429);
  await again.close();
});

test("built frontend assets skip the board password", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const app = createApp(new Fleet(store), "board");
  const response = await app.request("/assets/login.js");
  assert.equal(response.status, 404);
  await store.close();
});

test("API responses include security headers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const app = createApp(new Fleet(store), "board");
  const response = await app.request("/api/sites");
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-store");
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

async function loginCookie(app: ReturnType<typeof createApp>, password: string): Promise<string> {
  const response = await app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.ok(header);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Max-Age=604800/);
  const match = header.match(/^watch=([^;]+)/);
  assert.ok(match?.[1]);
  return `watch=${match[1]}`;
}
