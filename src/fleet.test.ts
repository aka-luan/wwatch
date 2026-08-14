import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Fleet } from "./fleet.js";
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
