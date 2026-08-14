import assert from "node:assert/strict";
import { test } from "node:test";

test("vercel entry exports a web fetch handler", async () => {
  const mod = await import("./index.js");
  assert.equal(typeof mod.default.fetch, "function");
  const response = await mod.default.fetch(new Request("http://wwatch.test/"));
  assert.equal(response.status, 500);
  const body = (await response.json()) as { error?: string };
  assert.match(String(body.error), /DASHBOARD_PASSWORD|TURSO_/);
});
