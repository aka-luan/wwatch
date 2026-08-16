import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Fleet } from "./fleet.js";
import { asScanId, asSiteId } from "./domain.js";
import { Store } from "./store.js";

test("connect rejects a duplicate origin and startScan is idempotent while running", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const fleet = new Fleet(store, {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      calls += 1;
      const url = String(input);
      if (calls <= 2) {
        if (url.endsWith("/wp-json")) {
          return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      }
      await gate;
      throw new Error("connect ECONNREFUSED");
    },
  });
  const site = await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa bbbb",
  });
  await assert.rejects(
    () =>
      fleet.connect({
        name: "Again",
        origin: "https://bakery.example/wp-admin",
        username: "luan",
        applicationPassword: "aaaa",
      }),
    /Already connected/,
  );
  const first = await fleet.startScan(site.id);
  const second = await fleet.startScan(site.id);
  assert.equal(first.id, second.id);
  assert.equal((await fleet.overview())[0]?.rollup, "running");
  release();
  const row = await waitUntil((item) => Boolean(item?.latest) && !item?.running);
  assert.ok(row);
  assert.equal(row.rollup, "down");
  await store.close();

  async function waitUntil(
    ok: (row: Awaited<ReturnType<Fleet["overview"]>>[number] | undefined) => boolean,
  ) {
    for (let i = 0; i < 50; i += 1) {
      const current = (await fleet.overview())[0];
      if (ok(current)) {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("scan did not settle");
  }
});

test("connect rejects a bad application password before storing the site", async () => {
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
      return new Response("no", { status: 401 });
    },
  });
  await assert.rejects(
    () =>
      fleet.connect({
        name: "Bakery",
        origin: "https://bakery.example",
        username: "luan",
        applicationPassword: "wrong",
      }),
    /did not see the Application Password/,
  );
  assert.equal((await store.listSites()).length, 0);
  await store.close();
});

test("a second Fleet on the same store sees a running job", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const path = join(dir, "watch.db");
  const store = new Store(path);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const fleet = new Fleet(store, {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      calls += 1;
      if (calls <= 2) {
        const url = String(input);
        if (url.endsWith("/wp-json")) {
          return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      }
      await gate;
      throw new Error("connect ECONNREFUSED");
    },
  });
  const site = await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa",
  });
  await fleet.startScan(site.id);
  const other = new Fleet(new Store(path), {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => null,
    fetch: async () => new Response("[]"),
  });
  const row = (await other.overview())[0];
  assert.ok(row?.running);
  assert.equal(row.rollup, "running");
  release();
  await waitFor((item) => Boolean(item?.latest) && !item?.running);
  await store.close();

  async function waitFor(
    ok: (row: Awaited<ReturnType<Fleet["overview"]>>[number] | undefined) => boolean,
  ) {
    for (let i = 0; i < 50; i += 1) {
      if (ok((await fleet.overview())[0])) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("scan did not settle");
  }
});

test("a new down finding alerts once until the site recovers and drops again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  const alerts: string[] = [];
  let mode: "connect" | "down" | "up" = "connect";
  let nowMs = Date.parse("2026-08-13T12:00:00.000Z");
  const fleet = new Fleet(
    store,
    {
      now: () => {
        nowMs += 1000;
        return new Date(nowMs);
      },
      tlsDaysLeft: async () => null,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes("api.telegram.org")) {
          alerts.push(url);
          return new Response("{}", { status: 200 });
        }
        if (mode === "down") {
          throw new Error("connect ECONNREFUSED");
        }
        if (url.endsWith("/wp-json")) {
          return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
        }
        if (url.includes("/wp-json/wp/v2/plugins")) {
          return new Response("[]", { status: 200 });
        }
        if (url.endsWith("/") || url.includes("bakery.example")) {
          return new Response("<html></html>", { status: 200 });
        }
        return new Response("no", { status: 404 });
      },
    },
    { channels: [{ kind: "telegram", token: "tok", chatId: "99" }] },
  );
  const site = await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa",
  });

  mode = "down";
  const first = await scanUntil(site.id, (row) => row.rollup === "down");
  assert.equal(alerts.length, 1);
  assert.equal(first.latest?.findings[0]?.kind, "down");

  await scanUntil(site.id, (row) => row.rollup === "down");
  assert.equal(alerts.length, 1);

  mode = "up";
  const recovered = await scanUntil(site.id, (row) => row.rollup === "ok");
  assert.equal(alerts.length, 1);
  assert.equal(recovered.latest?.findings.length, 0);

  mode = "down";
  await scanUntil(site.id, (row) => row.rollup === "down");
  assert.equal(alerts.length, 2);
  await store.close();

  async function scanUntil(
    id: string,
    ok: (row: NonNullable<Awaited<ReturnType<Fleet["overview"]>>[number]>) => boolean,
  ) {
    const previousId = (await fleet.sitePage(asSiteId(id)))?.latest?.id;
    await fleet.startScan(asSiteId(id));
    for (let i = 0; i < 50; i += 1) {
      const row = (await fleet.overview())[0];
      if (row && !row.running && row.latest && row.latest.id !== previousId && ok(row)) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const row = (await fleet.overview())[0];
    throw new Error(`scan did not settle (${row?.rollup}): ${JSON.stringify(row?.latest?.findings)}`);
  }
});

test("update renames without reconnecting and rotates a password after assertConnect", async () => {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  const store = new Store(join(dir, "watch.db"));
  let pluginCalls = 0;
  const fleet = new Fleet(store, {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/wp-json")) {
        return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
      }
      if (url.includes("/wp-json/wp/v2/plugins")) {
        pluginCalls += 1;
        return new Response("[]", { status: 200 });
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
  const afterConnect = pluginCalls;
  await fleet.update(site.id, { name: "Shop" });
  assert.equal(pluginCalls, afterConnect);
  const page = await fleet.sitePage(site.id);
  assert.equal(page.site.name, "Shop");
  assert.equal(page.username, "luan");
  await fleet.update(site.id, { applicationPassword: "bbbb cccc" });
  assert.ok(pluginCalls > afterConnect);
  assert.equal((await store.getSite(site.id))?.applicationPassword, "bbbbcccc");
  await store.close();
});

test("update keeps the old password when connect fails", async () => {
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
  allow = false;
  await assert.rejects(() => fleet.update(site.id, { applicationPassword: "nope" }), /Application Password|did not see/);
  assert.equal((await store.getSite(site.id))?.applicationPassword, "aaaa");
  await store.close();
});

test("sitePage lists earlier scans newest first", async () => {
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
  const site = await fleet.connect({
    name: "Bakery",
    origin: "https://bakery.example",
    username: "luan",
    applicationPassword: "aaaa",
  });
  await store.insertScan({
    id: asScanId("c1"),
    siteId: site.id,
    startedAt: "2026-08-12T10:00:00.000Z",
    finishedAt: "2026-08-12T10:00:05.000Z",
    rollup: "down",
    coreVersion: null,
    plugins: [],
    findings: [{ kind: "down", severity: "crit", title: "down", detail: "" }],
    helper: null,
  });
  await store.insertScan({
    id: asScanId("c2"),
    siteId: site.id,
    startedAt: "2026-08-13T10:00:00.000Z",
    finishedAt: "2026-08-13T10:00:05.000Z",
    rollup: "ok",
    coreVersion: "6.7.1",
    plugins: [],
    findings: [],
    helper: { kind: "installed", version: "1.1.0", capabilities: ["login", "update"] },
  });
  const page = await fleet.sitePage(site.id);
  assert.equal(page.latest?.id, "c2");
  assert.equal(page.history.length, 2);
  assert.equal(page.history[0]?.id, "c2");
  assert.equal(page.history[1]?.id, "c1");
  assert.equal(page.history[1]?.counts.crit, 1);
  assert.equal(page.history[1]?.counts.updates, 0);
  assert.equal(page.history[0]?.counts.updates, 0);
  await store.close();
});
