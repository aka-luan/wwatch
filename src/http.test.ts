import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Fleet } from "./fleet.js";
import { createApp, SESSION_TTL_MS, sessionToken } from "./http.js";
import { Store } from "./store.js";
import { asScanId } from "./domain.js";

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
  assert.match(response.headers.get("content-security-policy") ?? "", /style-src-attr 'unsafe-inline'/);
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

test("POST /api/sites/:id/wp-login mints a helper URL and GET /api/helper-plugin downloads the plugin", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const token = "ab".repeat(32);
  const fleet = new Fleet(store, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1/login-link")) {
        return new Response(
          JSON.stringify({
            token,
            url: `https://bakery.example/?wwatch_login=${token}`,
            expires_in: 30,
          }),
          { status: 200 },
        );
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

  const denied = await app.request(`/api/sites/${site.id}/wp-login`, { method: "POST" });
  assert.equal(denied.status, 401);

  const login = await app.request(`/api/sites/${site.id}/wp-login`, {
    method: "POST",
    headers: { cookie: session },
  });
  assert.equal(login.status, 200);
  assert.equal(((await login.json()) as { url: string }).url, `https://bakery.example/?wwatch_login=${token}`);

  const missing = await app.request("/api/sites/nope/wp-login", {
    method: "POST",
    headers: { cookie: session },
  });
  assert.equal(missing.status, 404);

  const lockedPlugin = await app.request("/api/helper-plugin");
  assert.equal(lockedPlugin.status, 401);

  const plugin = await app.request("/api/helper-plugin", { headers: { cookie: session } });
  assert.equal(plugin.status, 200);
  assert.match(plugin.headers.get("content-disposition") ?? "", /filename="wwatch\.php"/);
  assert.match(await plugin.text(), /Plugin Name: wwatch/);
  await store.close();
});

test("POST /api/sites/:id/wp-login says to install the plugin when the route is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const fleet = new Fleet(store, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1/login-link")) {
        return new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 });
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
  const app = createApp(fleet);
  const response = await app.request(`/api/sites/${site.id}/wp-login`, { method: "POST" });
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { error: string }).error, /Install the wwatch plugin/);
  await store.close();
});

test("POST /api/sites/:id/update runs the helper then starts a scan", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const updates: string[] = [];
  const fleet = new Fleet(store, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2", "wwatch/v1"] }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1/update")) {
        updates.push(String(init?.body ?? ""));
        return new Response(JSON.stringify({ ok: true, detail: "Updated akismet/akismet.php." }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1")) {
        return new Response(JSON.stringify({ version: "1.1.0", capabilities: ["login", "update"] }), {
          status: 200,
        });
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
  const app = createApp(fleet);
  const badKind = await app.request(`/api/sites/${site.id}/update`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "plugins" }),
  });
  assert.equal(badKind.status, 400);

  const updated = await app.request(`/api/sites/${site.id}/update`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "plugin", plugin: "akismet/akismet.php" }),
  });
  assert.equal(updated.status, 200);
  assert.match(((await updated.json()) as { detail: string }).detail, /akismet/);
  assert.match(updates[0] ?? "", /"kind":"plugin"/);

  const missing = await app.request("/api/sites/nope/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "core" }),
  });
  assert.equal(missing.status, 404);
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

test("POST /api/sites/:id/repair runs the helper then starts a scan", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const repairs: string[] = [];
  const fleet = new Fleet(store, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2", "wwatch/v1"] }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1/repair")) {
        repairs.push(String(init?.body ?? ""));
        return new Response(JSON.stringify({ ok: true, detail: "Deleted debug.log." }), { status: 200 });
      }
      if (url.endsWith("/wp-json/wwatch/v1")) {
        return new Response(JSON.stringify({ version: "1.2.0", capabilities: ["login", "update", "repair"] }), {
          status: 200,
        });
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
  const app = createApp(fleet);
  const badPath = await app.request(`/api/sites/${site.id}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "exposed_path", path: "/wp-config.php" }),
  });
  assert.equal(badPath.status, 400);
  assert.match(((await badPath.json()) as { error: string }).error, /cannot be repaired/);

  const git = await app.request(`/api/sites/${site.id}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "exposed_path", path: "/.git/HEAD" }),
  });
  assert.equal(git.status, 400);

  await store.putJob(site.id, { id: asScanId("running-1"), startedAt: new Date().toISOString() });
  const busy = await app.request(`/api/sites/${site.id}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "xmlrpc" }),
  });
  assert.equal(busy.status, 400);
  assert.match(((await busy.json()) as { error: string }).error, /Wait for the current scan/);
  await store.deleteJob(site.id);

  const repaired = await app.request(`/api/sites/${site.id}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "exposed_path", path: "/debug.log" }),
  });
  assert.equal(repaired.status, 200);
  assert.match(((await repaired.json()) as { detail: string }).detail, /debug\.log/);
  assert.match(repairs[0] ?? "", /"kind":"exposed_path"/);

  for (let i = 0; i < 50; i += 1) {
    const row = (await fleet.overview())[0];
    if (row && !row.running && row.latest) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const xmlrpcOk = await app.request(`/api/sites/${site.id}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "xmlrpc" }),
  });
  assert.equal(xmlrpcOk.status, 200);
  assert.match(repairs[1] ?? "", /"kind":"xmlrpc"/);

  const missing = await app.request("/api/sites/nope/repair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "xmlrpc" }),
  });
  assert.equal(missing.status, 404);
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
