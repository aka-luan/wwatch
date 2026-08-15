import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fleet } from "../src/fleet.js";
import { createLocalApp as createApp } from "../src/server.js";
import { Store } from "../src/store.js";
import type { ScanDeps } from "../src/scan.js";

const wp = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/") {
    res.setHeader("content-type", "text/html");
    res.end(`<meta name="generator" content="WordPress 6.4.2" /><a href="/missing">x</a>`);
    return;
  }
  if (url === "/wp-json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ namespaces: ["wp/v2"] }));
    return;
  }
  if (url.startsWith("/wp-json/wp/v2/plugins")) {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify([
        { plugin: "akismet/akismet.php", name: "Akismet", version: "1.0.0", status: "active" },
      ]),
    );
    return;
  }
  if (url.startsWith("/wp-json/wp-site-health/")) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: "good", label: "ok", description: "" }));
    return;
  }
  res.statusCode = 404;
  res.end("no");
});

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

const home = await app.request("/");
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /wwatch/);

const scanAll = await app.request("/api/scan-all");
assert.equal(scanAll.status, 200);
const started = (await scanAll.json()) as { started: number };
assert.equal(started.started, 1);

wp.close();
console.log("verify ok");

async function waitForScan(app: ReturnType<typeof createApp>, id: string) {
  for (let i = 0; i < 50; i += 1) {
    const response = await app.request(`/api/sites/${id}`);
    const page = (await response.json()) as {
      rollup: string;
      running: unknown;
      latest: { findings: Array<{ kind: string }> };
    };
    if (!page.running && page.latest) {
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("scan did not finish");
}
