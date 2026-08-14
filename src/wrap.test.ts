import assert from "node:assert/strict";
import { test } from "node:test";
import { keyFromSecret, unwrapPassword, wrapPassword, wrapSecretFromEnv } from "./wrap.js";

test("wrapSecretFromEnv prefers WATCH_SECRET over the board password", () => {
  assert.equal(wrapSecretFromEnv({}), undefined);
  assert.equal(wrapSecretFromEnv({ DASHBOARD_PASSWORD: "board" }), "board");
  assert.equal(wrapSecretFromEnv({ WATCH_SECRET: "wrap", DASHBOARD_PASSWORD: "board" }), "wrap");
  assert.equal(wrapSecretFromEnv({ WATCH_SECRET: "  " }), undefined);
});

test("wrapPassword round-trips and rejects the wrong key", () => {
  const key = keyFromSecret("board");
  const stored = wrapPassword("aaaa bbbb", key);
  assert.match(stored, /^v1:/);
  assert.equal(unwrapPassword(stored, key), "aaaa bbbb");
  assert.equal(unwrapPassword("plaintext", key), "plaintext");
  assert.throws(() => unwrapPassword(stored, keyFromSecret("other")), /WATCH_SECRET/);
  assert.throws(() => unwrapPassword(stored, null), /DASHBOARD_PASSWORD/);
});
