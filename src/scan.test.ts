import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { asSiteId, parseOrigin } from "./domain.js";
import { assertConnect, describeAuthFailure, runScan, type ScanDeps } from "./scan.js";

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
  assert.ok(snapshot.findings.some((f) => f.kind === "core_update" && f.latest === "6.7.1"));
  assert.ok(snapshot.findings.some((f) => f.kind === "broken_link" && f.httpStatus === 404));
  assert.ok(snapshot.findings.some((f) => f.kind === "exposed_path" && f.path === "/readme.html"));
  assert.ok(snapshot.findings.some((f) => f.kind === "site_health" && f.test === "https-status"));
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
