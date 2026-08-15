import assert from "node:assert/strict";
import { test } from "node:test";
import { asSiteId, parseOrigin, parsePluginRef } from "./domain.js";
import { applyHelperUpdate, helperPluginFile, loginUrlFrom, mintLoginLink, probeHelper } from "./helper.js";
import type { ScanDeps } from "./scan.js";

const site = {
  id: asSiteId("site-1"),
  name: "Bakery",
  origin: parseOrigin("https://bakery.example"),
  username: "luan",
  applicationPassword: "aaaa",
};

const token = "ab".repeat(32);

test("mintLoginLink returns the plugin URL when the helper is installed", async () => {
  const url = `https://bakery.example/?wwatch_login=${token}`;
  const result = await mintLoginLink(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input, init) => {
      assert.equal(String(input), "https://bakery.example/wp-json/wwatch/v1/login-link");
      assert.equal(init?.method, "POST");
      assert.match(new Headers(init?.headers).get("authorization") ?? "", /^Basic /);
      return new Response(JSON.stringify({ token, url, expires_in: 30 }), { status: 200 });
    },
  });
  assert.equal(result.url, url);
});

test("mintLoginLink builds a same-origin URL when the plugin only returns a token", async () => {
  const result = await mintLoginLink(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async () => new Response(JSON.stringify({ token }), { status: 200 }),
  });
  assert.equal(result.url, `https://bakery.example/?wwatch_login=${token}`);
});

test("mintLoginLink tells you to install the plugin when the route is missing", async () => {
  await assert.rejects(
    () =>
      mintLoginLink(site, {
        now: () => new Date(),
        tlsDaysLeft: async () => null,
        fetch: async () =>
          new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 }),
      }),
    /Install the wwatch plugin/,
  );
});

test("mintLoginLink rejects a login URL on another origin", async () => {
  await assert.rejects(
    () =>
      mintLoginLink(site, {
        now: () => new Date(),
        tlsDaysLeft: async () => null,
        fetch: async () =>
          new Response(
            JSON.stringify({ token, url: `https://evil.example/?wwatch_login=${token}` }),
            { status: 200 },
          ),
      }),
    /different origin/,
  );
});

test("mintLoginLink rejects a 403 from a non-admin application password", async () => {
  await assert.rejects(
    () =>
      mintLoginLink(site, {
        now: () => new Date(),
        tlsDaysLeft: async () => null,
        fetch: async () => new Response(JSON.stringify({ code: "rest_forbidden" }), { status: 403 }),
      }),
    /administrator/,
  );
});

test("loginUrlFrom requires the token in the query string", () => {
  assert.throws(
    () => loginUrlFrom("https://bakery.example", JSON.stringify({ token, url: "https://bakery.example/" })),
    /unreadable/,
  );
});

test("helperPluginFile serves the WordPress plugin from disk", () => {
  const file = helperPluginFile();
  assert.equal(file.filename, "wwatch.php");
  assert.match(file.body, /Plugin Name: wwatch/);
  assert.match(file.body, /wwatch\/v1/);
  assert.match(file.body, /login-link/);
  assert.match(file.body, /capabilities/);
  assert.match(file.body, /wwatch_run_update/);
});

test("probeHelper records an installed helper and a missing route", async () => {
  const installed = await probeHelper(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      assert.equal(String(input), "https://bakery.example/wp-json/wwatch/v1");
      return new Response(JSON.stringify({ version: "1.1.0", capabilities: ["login", "update"] }), {
        status: 200,
      });
    },
  });
  assert.deepEqual(installed, {
    kind: "installed",
    version: "1.1.0",
    capabilities: ["login", "update"],
  });

  const missing = await probeHelper(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async () => new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 }),
  });
  assert.deepEqual(missing, { kind: "missing" });
});

test("applyHelperUpdate posts plugin, theme, core, and all", async () => {
  const calls: string[] = [];
  const deps: ScanDeps = {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url} ${String(init?.body ?? "")}`);
      assert.equal(url, "https://bakery.example/wp-json/wwatch/v1/update");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ ok: true, detail: "Updated akismet/akismet.php." }), { status: 200 });
    },
  };
  const plugin = await applyHelperUpdate(site, { kind: "plugin", plugin: parsePluginRef("akismet/akismet.php") }, deps);
  assert.match(plugin.detail, /akismet/);
  const theme = await applyHelperUpdate(site, { kind: "theme", theme: "twentytwentyfour" }, deps);
  assert.match(theme.detail, /Updated/);
  await applyHelperUpdate(site, { kind: "core" }, deps);
  await applyHelperUpdate(site, { kind: "all" }, deps);
  assert.equal(calls.length, 5);
  assert.match(calls[0] ?? "", /"kind":"plugin"/);
  assert.match(calls[3] ?? "", /"kind":"plugins"/);
  assert.match(calls[4] ?? "", /"kind":"themes"/);
});

test("applyHelperUpdate asks for the current plugin when the update route is missing", async () => {
  await assert.rejects(
    () =>
      applyHelperUpdate(site, { kind: "core" }, {
        now: () => new Date(),
        tlsDaysLeft: async () => null,
        fetch: async () => new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 }),
      }),
    /current wwatch plugin/,
  );
});
