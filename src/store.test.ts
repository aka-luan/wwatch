import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { asScanId, asSiteId, parseOrigin, parsePluginRef } from "./domain.js";
import { Store } from "./store.js";

test("store round-trips a site and its latest scan", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const site = await store.insertSite({
    id: asSiteId("s1"),
    name: "Bakery",
    origin: parseOrigin("https://bakery.example"),
    username: "luan",
    applicationPassword: "secret",
  });
  assert.equal(site.origin, "https://bakery.example");
  assert.equal("applicationPassword" in site, false);

  await store.insertScan({
    id: asScanId("c1"),
    siteId: site.id,
    startedAt: "2026-08-13T10:00:00.000Z",
    finishedAt: "2026-08-13T10:00:05.000Z",
    rollup: "degraded",
    coreVersion: "6.7.1",
    plugins: [
      {
        ref: parsePluginRef("akismet/akismet.php"),
        slug: "akismet",
        name: "Akismet",
        version: "1.0",
        status: "active",
      },
    ],
    findings: [{ kind: "xmlrpc_open", severity: "info", title: "xmlrpc", detail: "" }],
    helper: { kind: "missing" },
  });

  const latest = await store.latestScan(site.id);
  assert.equal(latest?.coreVersion, "6.7.1");
  assert.equal(latest?.plugins[0]?.slug, "akismet");
  assert.equal(latest?.helper?.kind, "missing");
  const rows = await store.overview();
  assert.equal(rows[0]?.rollup, "degraded");
  await store.close();
});

test("latestScan prefers the later insert when finished_at ties", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const site = await store.insertSite({
    id: asSiteId("s1"),
    name: "Bakery",
    origin: parseOrigin("https://bakery.example"),
    username: "luan",
    applicationPassword: "secret",
  });
  const base = {
    siteId: site.id,
    startedAt: "2026-08-13T10:00:00.000Z",
    finishedAt: "2026-08-13T10:00:05.000Z",
    coreVersion: null,
    plugins: [] as never[],
    helper: null,
  };
  await store.insertScan({
    ...base,
    id: asScanId("c1"),
    rollup: "down",
    findings: [{ kind: "down", severity: "crit", title: "down", detail: "" }],
  });
  await store.insertScan({
    ...base,
    id: asScanId("c2"),
    rollup: "ok",
    findings: [],
  });
  const latest = await store.latestScan(site.id);
  assert.equal(latest?.id, "c2");
  assert.equal(latest?.rollup, "ok");
  const history = await store.listScans(site.id);
  assert.equal(history.map((scan) => scan.id).join(","), "c2,c1");
  await store.close();
});

test("wrapSecret encrypts application passwords and migrates plaintext rows", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const path = join(dir, "watch.db");
  const plain = new Store(path);
  await plain.insertSite({
    id: asSiteId("s1"),
    name: "Bakery",
    origin: parseOrigin("https://bakery.example"),
    username: "luan",
    applicationPassword: "secret",
  });
  await plain.close();

  const wrapped = new Store({ url: `file:${path}`, wrapSecret: "board" });
  const site = await wrapped.getSite(asSiteId("s1"));
  assert.equal(site?.applicationPassword, "secret");
  await wrapped.updateSite({
    id: asSiteId("s1"),
    name: "Shop",
    origin: parseOrigin("https://bakery.example"),
    username: "luan",
    applicationPassword: "rotated",
  });
  assert.equal((await wrapped.getSite(asSiteId("s1")))?.name, "Shop");
  await wrapped.close();

  const other = new Store({ url: `file:${path}`, wrapSecret: "other" });
  await assert.rejects(() => other.getSite(asSiteId("s1")), /WATCH_SECRET|decrypt/);
  await other.close();
});

test("login lockout is stored and survives a new Store on the same file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const path = join(dir, "watch.db");
  const store = new Store(path);
  for (let i = 0; i < 10; i += 1) {
    await store.recordLoginFailure("203.0.113.9");
  }
  assert.equal(await store.loginAllowed("203.0.113.9"), false);
  assert.equal(await store.loginAllowed("198.51.100.10"), true);
  await store.close();

  const again = new Store(path);
  assert.equal(await again.loginAllowed("203.0.113.9"), false);
  await again.clearLoginFailures("203.0.113.9");
  assert.equal(await again.loginAllowed("203.0.113.9"), true);
  await again.close();
});

test("remote Turso URLs do not load the native libsql addon", async () => {
  const store = new Store({ url: "http://127.0.0.1:1", authToken: "token" });
  await assert.rejects(() => store.listSites(), (error: unknown) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    assert.equal(message.includes("Cannot find module '@libsql/"), false);
    assert.match(message, /fetch|ECONNREFUSED|network|connect|HTTP/i);
    return true;
  });
});
