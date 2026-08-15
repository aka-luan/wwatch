import assert from "node:assert/strict";
import { test } from "node:test";
import { asSiteId, parseOrigin } from "./domain.js";
import { helperPluginFile, loginUrlFrom, mintLoginLink } from "./helper.js";

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
});
