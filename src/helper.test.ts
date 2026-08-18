import assert from "node:assert/strict";
import { test } from "node:test";
import { asSiteId, parseOrigin, parsePluginRef } from "./domain.js";
import { applyHelperRepair, applyHelperUpdate, fetchHelperHealth, findingsFromHealth, helperPluginFile, helperPluginSource, loginUrlFrom, mintLoginLink, parseHelperHealth, probeHelper } from "./helper.js";
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
  const file = { filename: helperPluginFile().filename, body: helperPluginSource() };
  assert.equal(file.filename, "wwatch.zip");
  assert.match(file.body, /Plugin Name: wwatch/);
  assert.match(file.body, /wwatch\/v1/);
  assert.match(file.body, /login-link/);
  assert.match(file.body, /capabilities/);
  assert.match(file.body, /wwatch_run_update/);
  assert.match(file.body, /wwatch_run_repair/);
  assert.match(file.body, /wwatch_health/);
  assert.match(file.body, /Version: 1\.4\.0/);
  assert.match(file.body, /"\/status"/);
  assert.match(file.body, /"repair"/);
  assert.match(file.body, /\/health/);
  assert.match(file.body, /xmlrpc_enabled/);
  assert.match(file.body, /wp-config\.php\.bak/);
  assert.match(file.body, /wwatch_xmlrpc_disabled/);
  assert.doesNotMatch(file.body, /unlink\([^)]*wp-config\.php["']/);
});

test("probeHelper records an installed helper and a missing route", async () => {
  const installed = await probeHelper(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      assert.equal(String(input), "https://bakery.example/wp-json/wwatch/v1/status");
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

test("probeHelper falls back to the namespace root for helpers older than 1.3.1", async () => {
  const seen: string[] = [];
  const helper = await probeHelper(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith("/status")) {
        return new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 });
      }
      return new Response(JSON.stringify({ version: "1.3.0", capabilities: ["login", "update", "repair"] }), {
        status: 200,
      });
    },
  });
  assert.deepEqual(seen, [
    "https://bakery.example/wp-json/wwatch/v1/status",
    "https://bakery.example/wp-json/wwatch/v1/",
  ]);
  assert.deepEqual(helper, {
    kind: "installed",
    version: "1.3.0",
    capabilities: ["login", "update", "repair"],
  });
});

test("helperPluginFile packages the plugin as a zip WordPress will accept", () => {
  const file = helperPluginFile();
  assert.equal(file.filename, "wwatch.zip");
  assert.equal(file.contentType, "application/zip");
  assert.equal(file.body.subarray(0, 4).toString("hex"), "504b0304");
  assert.match(file.body.toString("latin1"), /wwatch\/wwatch\.php/);
  assert.match(file.body.toString("latin1"), /Plugin Name: wwatch/);
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

test("applyHelperRepair posts xmlrpc and allowlisted paths", async () => {
  const calls: string[] = [];
  const deps: ScanDeps = {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url} ${String(init?.body ?? "")}`);
      assert.equal(url, "https://bakery.example/wp-json/wwatch/v1/repair");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ ok: true, detail: "Deleted debug.log." }), { status: 200 });
    },
  };
  const log = await applyHelperRepair(site, { kind: "exposed_path", path: "/debug.log" }, deps);
  assert.match(log.detail, /debug\.log/);
  await applyHelperRepair(site, { kind: "xmlrpc" }, deps);
  await applyHelperRepair(site, { kind: "exposed_path", path: "/wp-config.php.bak" }, deps);
  assert.equal(calls.length, 3);
  assert.match(calls[0] ?? "", /"kind":"exposed_path"/);
  assert.match(calls[1] ?? "", /"kind":"xmlrpc"/);
  assert.match(calls[2] ?? "", /wp-config\.php\.bak/);
});

test("applyHelperRepair asks for the current plugin when the repair route is missing", async () => {
  await assert.rejects(
    () =>
      applyHelperRepair(site, { kind: "xmlrpc" }, {
        now: () => new Date(),
        tlsDaysLeft: async () => null,
        fetch: async () => new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 }),
      }),
    /current wwatch plugin/,
  );
});

test("parseHelperHealth reads counts and names, and ignores junk", () => {
  assert.equal(parseHelperHealth(null), null);
  assert.equal(parseHelperHealth("nope"), null);
  const health = parseHelperHealth({
    php: { version: "7.0.33", required: "7.2.24", memory_limit: "32M", memory_bytes: 32 * 1024 * 1024 },
    wp_debug: true,
    disallow_file_edit: false,
    disallow_file_mods: true,
    automatic_updater_disabled: true,
    checksums: { matched: 1200, mismatched: 3, skipped: 40, files: ["wp-admin/about.php"] },
    mu_plugins: ["sunrise.php", "../evil.php", 12],
    dropins: ["object-cache.php"],
    cron: { disabled: true, missed: 2 },
    autoload_bytes: 1_500_000,
    users: { administrators: 3, login_admin: true, id_1: true },
  });
  assert.deepEqual(health?.php, {
    version: "7.0.33",
    required: "7.2.24",
    memoryLimit: "32M",
    memoryBytes: 32 * 1024 * 1024,
  });
  assert.equal(health?.wpDebug, true);
  assert.equal(health?.disallowFileEdit, false);
  assert.equal(health?.disallowFileMods, true);
  assert.equal(health?.automaticUpdaterDisabled, true);
  assert.deepEqual(health?.checksums, { matched: 1200, mismatched: 3, skipped: 40 });
  assert.deepEqual(health?.muPlugins, ["sunrise.php"]);
  assert.deepEqual(health?.dropins, ["object-cache.php"]);
  assert.deepEqual(health?.cron, { disabled: true, missed: 2 });
  assert.equal(health?.autoloadBytes, 1_500_000);
  assert.deepEqual(health?.users, { administrators: 3, loginAdmin: true, id1: true });
});

test("findingsFromHealth emits one finding per helper fact that is actually a problem", () => {
  const health = parseHelperHealth({
    php: { version: "7.0.33", required: "7.2.24", memory_limit: "32M", memory_bytes: 32 * 1024 * 1024 },
    wp_debug: true,
    disallow_file_edit: false,
    disallow_file_mods: true,
    automatic_updater_disabled: true,
    checksums: { matched: 10, mismatched: 2, skipped: 1 },
    mu_plugins: ["sunrise.php"],
    dropins: ["object-cache.php"],
    cron: { disabled: true, missed: 2 },
    autoload_bytes: 2 * 1024 * 1024,
    users: { administrators: 3, login_admin: true, id_1: true },
  });
  assert.ok(health);
  const findings = findingsFromHealth(health, { httpsOrigin: true });
  const kinds = findings.map((finding) => finding.kind);
  assert.deepEqual(kinds, [
    "php_runtime",
    "wp_debug",
    "file_edit_allowed",
    "updates_blocked",
    "core_checksums",
    "hidden_code",
    "cron",
    "autoload_size",
    "admin_users",
  ]);
  assert.equal(findings.find((f) => f.kind === "php_runtime")?.severity, "crit");
  assert.equal(findings.find((f) => f.kind === "updates_blocked")?.severity, "warn");
  assert.equal(findings.find((f) => f.kind === "core_checksums")?.mismatched, 2);
});

test("findingsFromHealth skips WP_DEBUG on http and skips a clean payload", () => {
  const noisy = parseHelperHealth({
    php: { version: "8.2.10", required: "7.2.24", memory_limit: "256M", memory_bytes: 256 * 1024 * 1024 },
    wp_debug: true,
    disallow_file_edit: true,
    disallow_file_mods: false,
    automatic_updater_disabled: false,
    checksums: { matched: 100, mismatched: 0, skipped: 20 },
    mu_plugins: [],
    dropins: [],
    cron: { disabled: false, missed: 0 },
    autoload_bytes: 12_000,
    users: { administrators: 1, login_admin: false, id_1: false },
  });
  assert.ok(noisy);
  assert.equal(findingsFromHealth(noisy, { httpsOrigin: false }).length, 0);
  assert.equal(findingsFromHealth(noisy, { httpsOrigin: true })[0]?.kind, "wp_debug");
});

test("findingsFromHealth treats AUTOMATIC_UPDATER_DISABLED alone as info", () => {
  const health = parseHelperHealth({
    disallow_file_mods: false,
    automatic_updater_disabled: true,
  });
  assert.ok(health);
  const findings = findingsFromHealth(health, { httpsOrigin: false });
  assert.equal(findings[0]?.kind, "updates_blocked");
  assert.equal(findings[0]?.severity, "info");
});

test("fetchHelperHealth returns null when the route is missing", async () => {
  const missing = await fetchHelperHealth(site, {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async (input) => {
      assert.equal(String(input), "https://bakery.example/wp-json/wwatch/v1/health");
      return new Response(JSON.stringify({ code: "rest_no_route" }), { status: 404 });
    },
  });
  assert.equal(missing, null);
});
