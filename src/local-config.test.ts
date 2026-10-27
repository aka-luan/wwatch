import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertExposureSafe, ensureWatchSecret, secretPath } from "./local-config.js";

test("ensureWatchSecret mints a secret beside the database once, owner-only, and reuses it", () => {
  const dir = mkdtempSync(join(tmpdir(), "wwatch-secret-"));
  const env: NodeJS.Dict<string> = { WATCH_DB: join(dir, "nested", "watch.db") };
  const first = ensureWatchSecret(env);
  assert.ok(first.length >= 43);
  assert.equal(env.WATCH_SECRET, first);

  const path = join(dir, "nested", "watch.secret");
  assert.equal(readFileSync(path, "utf8").trim(), first);
  assert.equal(statSync(path).mode & 0o777, 0o600);

  assert.equal(ensureWatchSecret({ WATCH_DB: join(dir, "nested", "watch.db") }), first);
});

test("ensureWatchSecret keeps an explicit WATCH_SECRET and writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "wwatch-secret-"));
  const env: NodeJS.Dict<string> = { WATCH_SECRET: " set ", WATCH_DB: join(dir, "watch.db") };
  assert.equal(ensureWatchSecret(env), "set");
  assert.throws(() => statSync(join(dir, "watch.secret")), /ENOENT/);
});

test("ensureWatchSecret reads a secret file that already exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "wwatch-secret-"));
  writeFileSync(join(dir, "watch.secret"), "kept\n");
  assert.equal(ensureWatchSecret({ WATCH_DB: `file:${join(dir, "watch.db")}` }), "kept");
});

test("ensureWatchSecret refuses to invent a secret for a shared Turso database", () => {
  assert.throws(() => ensureWatchSecret({ TURSO_DATABASE_URL: "libsql://x.turso.io" }), /Set WATCH_SECRET/);
});

test("secretPath sits next to the database file", () => {
  assert.equal(secretPath("data/watch.db"), join("data", "watch.secret"));
  assert.equal(secretPath("file:/var/lib/wwatch/watch.db"), "/var/lib/wwatch/watch.secret");
});

test("assertExposureSafe requires a password off loopback", () => {
  assert.doesNotThrow(() => assertExposureSafe("127.0.0.1", ""));
  assert.doesNotThrow(() => assertExposureSafe("localhost", ""));
  assert.doesNotThrow(() => assertExposureSafe("::1", ""));
  assert.doesNotThrow(() => assertExposureSafe("0.0.0.0", "pw"));
  assert.throws(() => assertExposureSafe("0.0.0.0", ""), /DASHBOARD_PASSWORD/);
  assert.throws(() => assertExposureSafe("192.168.1.10", ""), /DASHBOARD_PASSWORD/);
});
