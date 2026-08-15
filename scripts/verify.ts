import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fleet } from "../src/fleet.js";
import { createLocalApp as createApp } from "../src/server.js";
import { Store } from "../src/store.js";
import type { ScanDeps } from "../src/scan.js";

let pluginVersion = "1.0.0";
let xmlrpcOpen = true;
let debugLogPublic = true;

const wp = createServer((req, res) => {
  void handleWp(req, res);
});

async function handleWp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? "/";
  if (url === "/") {
    res.setHeader("content-type", "text/html");
    res.end(`<meta name="generator" content="WordPress 6.4.2" /><a href="/missing">x</a>`);
    return;
  }
  if (url === "/wp-json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ namespaces: ["wp/v2", "wwatch/v1"] }));
    return;
  }
  if (url.startsWith("/wp-json/wp/v2/plugins")) {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify([
        { plugin: "akismet/akismet.php", name: "Akismet", version: pluginVersion, status: "active" },
      ]),
    );
    return;
  }
  if (url.startsWith("/wp-json/wp-site-health/")) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: "good", label: "ok", description: "" }));
    return;
  }
  if (url === "/wp-json/wwatch/v1" || url === "/wp-json/wwatch/v1/") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ version: "1.3.0", capabilities: ["login", "update", "repair"] }));
    return;
  }
  if (url === "/wp-json/wwatch/v1/health" || url === "/wp-json/wwatch/v1/health/") {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        php: { version: "7.0.33", required: "7.2.24", memory_limit: "32M", memory_bytes: 33554432 },
        wp_debug: true,
        disallow_file_edit: false,
        disallow_file_mods: false,
        automatic_updater_disabled: false,
        checksums: { matched: 80, mismatched: 2, skipped: 5 },
        mu_plugins: ["sunrise.php"],
        dropins: ["object-cache.php"],
        cron: { disabled: false, missed: 1 },
        autoload_bytes: 2 * 1024 * 1024,
        users: { administrators: 2, login_admin: true, id_1: true },
      }),
    );
    return;
  }
  if (url.startsWith("/wp-json/wwatch/v1/update")) {
    pluginVersion = "1.2.0";
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, kind: "plugin", target: "akismet/akismet.php", detail: "Updated akismet/akismet.php." }));
    return;
  }
  if (url.startsWith("/wp-json/wwatch/v1/repair")) {
    const raw = await readBody(req);
    let body: { kind?: unknown; path?: unknown } = {};
    try {
      body = JSON.parse(raw) as { kind?: unknown; path?: unknown };
    } catch {
      body = {};
    }
    res.setHeader("content-type", "application/json");
    if (body.kind === "xmlrpc") {
      xmlrpcOpen = false;
      res.end(JSON.stringify({ ok: true, kind: "xmlrpc", detail: "XML-RPC disabled." }));
      return;
    }
    if (body.kind === "exposed_path" && (body.path === "/debug.log" || body.path === "/wp-content/debug.log")) {
      debugLogPublic = false;
      res.end(JSON.stringify({ ok: true, kind: "exposed_path", detail: "Deleted debug.log." }));
      return;
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "This path cannot be repaired from the board." }));
    return;
  }
  if (url.startsWith("/wp-json/wwatch/v1/login-link")) {
    const token = "ab".repeat(32);
    const host = req.headers.host ?? "127.0.0.1";
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        token,
        url: `http://${host}/?wwatch_login=${token}`,
        expires_in: 30,
      }),
    );
    return;
  }
  if (url === "/debug.log") {
    if (!debugLogPublic) {
      res.statusCode = 404;
      res.end("no");
      return;
    }
    res.end("[15-Aug-2026 12:00:00 UTC] PHP Warning: test");
    return;
  }
  if (url === "/xmlrpc.php") {
    if (!xmlrpcOpen) {
      res.statusCode = 403;
      res.setHeader("content-type", "text/plain");
      res.end("XML-RPC is disabled.");
      return;
    }
    res.setHeader("content-type", "text/xml");
    res.end("<methodResponse><params></params></methodResponse>");
    return;
  }
  res.statusCode = 404;
  res.end("no");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

await new Promise<void>((resolve) => wp.listen(0, "127.0.0.1", resolve));
const address = wp.address();
if (!address || typeof address === "string") {
  throw new Error("fake WordPress did not bind");
}
const origin = `http://127.0.0.1:${address.port}`;

const deps: ScanDeps = {
  now: () => new Date(),
  tlsDaysLeft: async () => 90,
  fetch: async (input, init) => {
    const url = String(input);
    if (url.includes("api.wordpress.org/plugins/info")) {
      return new Response(JSON.stringify({ version: "1.2.0" }), { status: 200 });
    }
    if (url.includes("api.wordpress.org/core/version-check")) {
      return new Response(JSON.stringify({ offers: [{ current: "6.7.1" }] }), { status: 200 });
    }
    return fetch(input, init);
  },
};

const dir = mkdtempSync(join(tmpdir(), "watch-verify-"));
const fleet = new Fleet(new Store(join(dir, "watch.db")), deps);
const app = createApp(fleet);

const created = await app.request("/api/sites", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Verify",
    origin,
    username: "luan",
    applicationPassword: "aaaa bbbb cccc dddd",
  }),
});
assert.equal(created.status, 201);
const site = (await created.json()) as { id: string };

await app.request(`/api/sites/${site.id}/scan`, { method: "POST" });
const page = await waitForScan(app, site.id);
assert.equal(page.rollup, "degraded");
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "plugin_update"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "broken_link"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "core_update"));
assert.equal(page.latest.helper?.kind, "installed");
assert.ok(page.latest.helper?.capabilities?.includes("update"));
assert.ok(page.latest.helper?.capabilities?.includes("repair"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "php_runtime"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "file_edit_allowed"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "core_checksums"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "hidden_code"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "cron"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "autoload_size"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "admin_users"));
assert.ok(page.latest.findings.some((f: { kind: string }) => f.kind === "xmlrpc_open"));
assert.ok(page.latest.findings.some((f: { kind: string; path?: string }) => f.kind === "exposed_path" && f.path === "/debug.log"));

const home = await app.request("/");
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /wwatch/);

const scanAll = await app.request("/api/scan-all");
assert.equal(scanAll.status, 200);
const started = (await scanAll.json()) as { started: number };
assert.equal(started.started, 1);
await waitForScan(app, site.id);

const login = await app.request(`/api/sites/${site.id}/wp-login`, { method: "POST" });
assert.equal(login.status, 200);
const minted = (await login.json()) as { url: string };
assert.match(minted.url, /wwatch_login=/);
assert.equal(new URL(minted.url).origin, origin);

const helper = await app.request("/api/helper-plugin");
assert.equal(helper.status, 200);
assert.match(helper.headers.get("content-disposition") ?? "", /wwatch\.php/);
assert.match(await helper.text(), /Plugin Name: wwatch/);

const beforeUpdate = await waitForScan(app, site.id);

const updated = await app.request(`/api/sites/${site.id}/update`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "plugin", plugin: "akismet/akismet.php" }),
});
assert.equal(updated.status, 200);
const afterUpdate = await waitForScan(app, site.id, beforeUpdate.latest.id);
assert.equal(
  afterUpdate.latest.findings.some((f: { kind: string }) => f.kind === "plugin_update"),
  false,
);
assert.equal(pluginVersion, "1.2.0");

const refused = await app.request(`/api/sites/${site.id}/repair`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "exposed_path", path: "/wp-config.php" }),
});
assert.equal(refused.status, 400);

const beforeRepair = await waitForScan(app, site.id);
const fixedLog = await app.request(`/api/sites/${site.id}/repair`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "exposed_path", path: "/debug.log" }),
});
assert.equal(fixedLog.status, 200);
const afterLog = await waitForScan(app, site.id, beforeRepair.latest.id);
assert.equal(
  afterLog.latest.findings.some((f: { kind: string; path?: string }) => f.kind === "exposed_path" && f.path === "/debug.log"),
  false,
);
assert.equal(debugLogPublic, false);

const fixedXmlrpc = await app.request(`/api/sites/${site.id}/repair`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "xmlrpc" }),
});
assert.equal(fixedXmlrpc.status, 200);
const afterXmlrpc = await waitForScan(app, site.id, afterLog.latest.id);
assert.equal(
  afterXmlrpc.latest.findings.some((f: { kind: string }) => f.kind === "xmlrpc_open"),
  false,
);
assert.equal(xmlrpcOpen, false);

wp.close();
console.log("verify ok");

async function waitForScan(app: ReturnType<typeof createApp>, id: string, previousId?: string) {
  for (let i = 0; i < 50; i += 1) {
    const response = await app.request(`/api/sites/${id}`);
    const page = (await response.json()) as {
      rollup: string;
      running: unknown;
      latest: { id?: string; findings: Array<{ kind: string }>; helper?: { kind?: string; capabilities?: string[] } };
    };
    if (!page.running && page.latest && page.latest.id !== previousId) {
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("scan did not finish");
}
