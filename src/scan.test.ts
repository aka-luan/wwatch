import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { asSiteId, parseOrigin } from "./domain.js";
import { assertConnect, assertPublicOrigin, describeAuthFailure, runScan, type ScanDeps } from "./scan.js";

test("runScan records plugin updates, broken links, and exposed paths", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url === "/home") {
      html(
        res,
        `<meta name="generator" content="WordPress 6.4.2" />
         <a href="/broken">gone</a>
         <a href="/ok">ok</a>`,
      );
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2"] });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins")) {
      json(res, [
        {
          plugin: "akismet/akismet.php",
          name: "Akismet",
          version: "1.0.0",
          status: "active",
        },
      ]);
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, [
        {
          stylesheet: "twentytwentyfour",
          name: { raw: "Twenty Twenty-Four", rendered: "Twenty Twenty-Four" },
          version: { raw: "1.0", rendered: "1.0" },
          status: "active",
        },
      ]);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/https-status")) {
      json(res, { status: "recommended", label: "HTTPS could be better", description: "<p>Fix TLS</p>" });
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    if (url === "/ok") {
      html(res, "ok");
      return;
    }
    if (url === "/broken") {
      res.statusCode = 404;
      res.end("missing");
      return;
    }
    if (url === "/readme.html") {
      html(res, "<h1>WordPress</h1>");
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const origin = `http://127.0.0.1:${portOf(server)}`;
  const deps = fakeOrg({
    fetch: globalThis.fetch,
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    tlsDaysLeft: async () => 90,
  });
  const snapshot = await runScan(
    {
      id: asSiteId("site-1"),
      name: "Test",
      origin: parseOrigin(origin),
      username: "luan",
      applicationPassword: "aaaa bbbb cccc dddd eeee ffff",
    },
    deps,
  );
  server.close();

  assert.equal(snapshot.coreVersion, "6.4.2");
  assert.equal(snapshot.plugins[0]?.slug, "akismet");
  assert.ok(snapshot.findings.some((f) => f.kind === "plugin_update" && f.latest === "1.2.0"));
  assert.ok(snapshot.findings.some((f) => f.kind === "plugin_stale"));
  assert.ok(snapshot.findings.some((f) => f.kind === "theme_update" && f.latest === "1.3"));
  assert.ok(snapshot.findings.some((f) => f.kind === "core_update" && f.latest === "6.7.1"));
  assert.ok(snapshot.findings.some((f) => f.kind === "broken_link" && f.httpStatus === 404));
  assert.ok(snapshot.findings.some((f) => f.kind === "exposed_path" && f.path === "/readme.html"));
  assert.ok(snapshot.findings.some((f) => f.kind === "site_health" && f.test === "https-status"));
  assert.equal(snapshot.helper?.kind, "missing");
  assert.equal(snapshot.rollup, "degraded");
});

test("runScan marks a dead origin as down", async () => {
  const snapshot = await runScan(
    {
      id: asSiteId("site-2"),
      name: "Dead",
      origin: parseOrigin("http://127.0.0.1:1"),
      username: "x",
      applicationPassword: "y",
    },
    {
      fetch: async () => {
        throw new Error("connect ECONNREFUSED");
      },
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => null,
    },
  );
  assert.equal(snapshot.rollup, "down");
  assert.equal(snapshot.findings[0]?.kind, "down");
  assert.equal(snapshot.helper, null);
});

test("runScan records the helper plugin when wwatch/v1 answers", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      html(res, `<meta name="generator" content="WordPress 6.7.1" />`);
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2", "wwatch/v1"] });
      return;
    }
    if (url === "/wp-json/wwatch/v1" || url === "/wp-json/wwatch/v1/") {
      json(res, { version: "1.2.0", capabilities: ["login", "update", "repair"] });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins") || url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, []);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const snapshot = await runScan(
    {
      id: asSiteId("site-helper"),
      name: "Helper",
      origin: parseOrigin(`http://127.0.0.1:${portOf(server)}`),
      username: "luan",
      applicationPassword: "aaaa",
    },
    fakeOrg({
      fetch: globalThis.fetch,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => 90,
    }),
  );
  server.close();
  assert.deepEqual(snapshot.helper, {
    kind: "installed",
    version: "1.2.0",
    capabilities: ["login", "update", "repair"],
  });
  assert.equal(
    snapshot.findings.some((f) =>
      f.kind === "php_runtime" ||
      f.kind === "wp_debug" ||
      f.kind === "file_edit_allowed" ||
      f.kind === "updates_blocked" ||
      f.kind === "core_checksums" ||
      f.kind === "hidden_code" ||
      f.kind === "cron" ||
      f.kind === "autoload_size" ||
      f.kind === "admin_users",
    ),
    false,
  );
});

test("runScan records helper health findings when /wwatch/v1/health answers", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      html(res, `<meta name="generator" content="WordPress 6.7.1" />`);
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2", "wwatch/v1"] });
      return;
    }
    if (url === "/wp-json/wwatch/v1" || url === "/wp-json/wwatch/v1/") {
      json(res, { version: "1.3.0", capabilities: ["login", "update", "repair"] });
      return;
    }
    if (url === "/wp-json/wwatch/v1/health" || url === "/wp-json/wwatch/v1/health/") {
      json(res, {
        php: { version: "7.0.33", required: "7.2.24", memory_limit: "32M", memory_bytes: 33554432 },
        wp_debug: true,
        disallow_file_edit: false,
        disallow_file_mods: false,
        automatic_updater_disabled: true,
        checksums: { matched: 80, mismatched: 2, skipped: 5 },
        mu_plugins: ["sunrise.php"],
        dropins: ["object-cache.php"],
        cron: { disabled: false, missed: 3 },
        autoload_bytes: 2 * 1024 * 1024,
        users: { administrators: 2, login_admin: true, id_1: true },
      });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins") || url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, []);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const snapshot = await runScan(
    {
      id: asSiteId("site-health"),
      name: "Health",
      origin: parseOrigin(`http://127.0.0.1:${portOf(server)}`),
      username: "luan",
      applicationPassword: "aaaa",
    },
    fakeOrg({
      fetch: globalThis.fetch,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => 90,
    }),
  );
  server.close();
  assert.equal(snapshot.helper?.kind, "installed");
  assert.ok(snapshot.findings.some((f) => f.kind === "php_runtime" && f.severity === "crit"));
  assert.ok(snapshot.findings.some((f) => f.kind === "file_edit_allowed"));
  assert.ok(snapshot.findings.some((f) => f.kind === "updates_blocked" && f.severity === "info"));
  assert.ok(snapshot.findings.some((f) => f.kind === "core_checksums" && f.mismatched === 2));
  assert.ok(snapshot.findings.some((f) => f.kind === "hidden_code"));
  assert.ok(snapshot.findings.some((f) => f.kind === "cron" && f.missed === 3));
  assert.ok(snapshot.findings.some((f) => f.kind === "autoload_size"));
  assert.ok(snapshot.findings.some((f) => f.kind === "admin_users" && f.loginAdmin));
  assert.equal(
    snapshot.findings.some((f) => f.kind === "wp_debug"),
    false,
  );
  assert.equal(snapshot.rollup, "degraded");
});

test("runScan reads core version from Site Health when the generator tag is missing", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      html(res, "<html><body>no generator</body></html>");
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2"] });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins") || url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, []);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/wordpress-version")) {
      json(res, {
        status: "good",
        label: "Your version of WordPress (6.4.2) is up to date",
        description: "<p>You are currently running the latest version of WordPress available.</p>",
      });
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const origin = `http://127.0.0.1:${portOf(server)}`;
  const snapshot = await runScan(
    {
      id: asSiteId("site-health-core"),
      name: "Hidden",
      origin: parseOrigin(origin),
      username: "luan",
      applicationPassword: "aaaa",
    },
    fakeOrg({
      fetch: globalThis.fetch,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => 90,
    }),
  );
  server.close();
  assert.equal(snapshot.coreVersion, "6.4.2");
  assert.ok(snapshot.findings.some((f) => f.kind === "core_update" && f.installed === "6.4.2" && f.latest === "6.7.1"));
  assert.equal(
    snapshot.findings.some((f) => f.kind === "site_health" && f.test === "wordpress-version"),
    false,
  );
});

test("runScan keeps the Site Health wordpress-version finding when the installed version is not in the copy", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      html(res, "<html></html>");
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2"] });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins") || url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, []);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/wordpress-version")) {
      json(res, {
        status: "critical",
        label: "WordPress update available (6.7.1)",
        description: "<p>A new version of WordPress is available.</p>",
      });
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const snapshot = await runScan(
    {
      id: asSiteId("site-health-unparsed"),
      name: "Hidden",
      origin: parseOrigin(`http://127.0.0.1:${portOf(server)}`),
      username: "luan",
      applicationPassword: "aaaa",
    },
    fakeOrg({
      fetch: globalThis.fetch,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => 90,
    }),
  );
  server.close();
  assert.equal(snapshot.coreVersion, null);
  assert.equal(
    snapshot.findings.some((f) => f.kind === "core_update"),
    false,
  );
  assert.ok(
    snapshot.findings.some(
      (f) => f.kind === "site_health" && f.test === "wordpress-version" && f.result === "critical",
    ),
  );
});

test("runScan uses currently running version from a critical wordpress-version test, not the offer", async () => {
  const server = await listen((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      html(res, "<html></html>");
      return;
    }
    if (url === "/wp-json") {
      json(res, { namespaces: ["wp/v2"] });
      return;
    }
    if (url.startsWith("/wp-json/wp/v2/plugins") || url.startsWith("/wp-json/wp/v2/themes")) {
      json(res, []);
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/wordpress-version")) {
      json(res, {
        status: "critical",
        label: "WordPress update available (6.7.1)",
        description: "<p>A new version of WordPress is available. Your site is currently running version 6.4.2.</p>",
      });
      return;
    }
    if (url.startsWith("/wp-json/wp-site-health/v1/tests/")) {
      json(res, { status: "good", label: "ok", description: "" });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  });
  const snapshot = await runScan(
    {
      id: asSiteId("site-health-running"),
      name: "Hidden",
      origin: parseOrigin(`http://127.0.0.1:${portOf(server)}`),
      username: "luan",
      applicationPassword: "aaaa",
    },
    fakeOrg({
      fetch: globalThis.fetch,
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => 90,
    }),
  );
  server.close();
  assert.equal(snapshot.coreVersion, "6.4.2");
  assert.ok(snapshot.findings.some((f) => f.kind === "core_update" && f.installed === "6.4.2"));
});

test("runScan does not follow homepage redirects off-origin", async () => {
  const fetched: string[] = [];
  await runScan(
    {
      id: asSiteId("site-ssrf"),
      name: "Redirect",
      origin: parseOrigin("https://bakery.example"),
      username: "luan",
      applicationPassword: "aaaa",
    },
    {
      now: () => new Date("2026-08-13T12:00:00.000Z"),
      tlsDaysLeft: async () => null,
      fetch: async (input) => {
        const url = String(input);
        fetched.push(url);
        if (url === "https://bakery.example/") {
          return new Response("", { status: 302, headers: { location: "https://169.254.169.254/" } });
        }
        if (url.endsWith("/wp-json")) {
          return new Response(JSON.stringify({ namespaces: ["wp/v2"] }), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      },
    },
  );
  assert.equal(
    fetched.some((url) => url.includes("169.254.169.254")),
    false,
  );
});

test("describeAuthFailure names Hostinger CDN when the header never reached WordPress", () => {
  const explained = describeAuthFailure({
    status: 401,
    body: JSON.stringify({
      code: "rest_cannot_view_plugins",
      message: "Sem permissão para gerenciar plugins deste site.",
      data: { status: 401 },
    }),
    headers: new Headers({ server: "hcdn", platform: "hostinger" }),
  });
  assert.equal(explained.title, "WordPress did not see the Application Password");
  assert.match(explained.detail, /Hostinger CDN/);
  assert.match(explained.detail, /WordPress login/);
});

test("describeAuthFailure keeps a real password rejection distinct from a stripped header", () => {
  const explained = describeAuthFailure({
    status: 401,
    body: JSON.stringify({
      code: "incorrect_password",
      message: "The provided password is an invalid application password.",
    }),
    headers: new Headers(),
  });
  assert.equal(explained.title, "Application Password was rejected");
  assert.match(explained.detail, /not the name you gave/);
  assert.doesNotMatch(explained.detail, /Hostinger/);
});

test("describeAuthFailure says a 403 plugin list means the user is not an administrator", () => {
  const explained = describeAuthFailure({
    status: 403,
    body: JSON.stringify({
      code: "rest_cannot_view_plugins",
      message: "Sorry, you are not allowed to manage plugins for this site.",
    }),
    headers: new Headers(),
  });
  assert.equal(explained.title, "This WordPress user cannot manage plugins");
  assert.match(explained.detail, /administrator/);
});

test("assertConnect explains a Hostinger 401 instead of calling it a bad password", async () => {
  const server = await listen((req, res) => {
    if (req.url === "/wp-json") {
      json(res, { namespaces: ["wp/v2"] });
      return;
    }
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.setHeader("server", "hcdn");
    res.setHeader("platform", "hostinger");
    res.end(JSON.stringify({ code: "rest_cannot_view_plugins", message: "Sem permissão", data: { status: 401 } }));
  });
  await assert.rejects(
    () =>
      assertConnect(
        {
          id: asSiteId("site-3"),
          name: "Skyrocket",
          origin: parseOrigin(`http://127.0.0.1:${portOf(server)}`),
          username: "wwatch",
          applicationPassword: "aaaa",
        },
        { fetch: globalThis.fetch, now: () => new Date(), tlsDaysLeft: async () => null },
      ),
    /Hostinger CDN/,
  );
  server.close();
});

function fakeOrg(base: ScanDeps): ScanDeps {
  return {
    ...base,
    fetch: async (input, init) => {
      const url = String(input);
      if (url.includes("api.wordpress.org/plugins/info")) {
        return new Response(JSON.stringify({ version: "1.2.0", last_updated: "2018-01-01" }), { status: 200 });
      }
      if (url.includes("api.wordpress.org/themes/info")) {
        return new Response(JSON.stringify({ version: "1.3" }), { status: 200 });
      }
      if (url.includes("api.wordpress.org/core/version-check")) {
        return new Response(JSON.stringify({ offers: [{ current: "6.7.1" }] }), { status: 200 });
      }
      return base.fetch(input, init);
    },
  };
}

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  return new Promise<ReturnType<typeof createServer>>((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function portOf(server: ReturnType<typeof createServer>): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("no port");
  }
  return address.port;
}

function json(res: ServerResponse, body: unknown): void {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, body: string): void {
  res.setHeader("content-type", "text/html");
  res.end(body);
}

test("a public hostname that resolves inside the network is refused", async () => {
  const site = {
    id: asSiteId("s1"),
    name: "Bakery",
    origin: parseOrigin("https://bakery.example"),
    username: "luan",
    applicationPassword: "aaaa",
  };
  const deps: ScanDeps = {
    now: () => new Date(),
    tlsDaysLeft: async () => null,
    fetch: async () => new Response("{}", { status: 200 }),
    resolveHost: async () => ["93.184.216.34", "10.0.0.7"],
  };

  await assert.rejects(() => assertPublicOrigin(site.origin, deps), /private address \(10\.0\.0\.7\)/);
  await assert.rejects(() => assertConnect(site, deps), /private address/);
  await assert.rejects(() => runScan(site, deps), /private address/);

  const publicOnly: ScanDeps = { ...deps, resolveHost: async () => ["93.184.216.34"] };
  await assertPublicOrigin(site.origin, publicOnly);

  // A name that will not resolve is left to the request itself to report.
  const unresolvable: ScanDeps = {
    ...deps,
    resolveHost: async () => {
      throw new Error("ENOTFOUND");
    },
  };
  await assertPublicOrigin(site.origin, unresolvable);

  // Loopback stays usable for local development and for npm run verify.
  const local: ScanDeps = { ...deps, resolveHost: async () => ["127.0.0.1"] };
  await assertPublicOrigin("http://127.0.0.1:8787", local);

  // Tests that leave resolveHost out do no DNS at all.
  await assertPublicOrigin(site.origin, { now: deps.now, tlsDaysLeft: deps.tlsDaysLeft, fetch: deps.fetch });
});
