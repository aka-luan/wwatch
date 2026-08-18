import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { isCurrentWrap, unwrapPassword, wrapPassword, wrapSecretsFromEnv } from "./wrap.js";

test("wrapSecretsFromEnv lists WATCH_SECRET first and keeps the board password as a fallback", () => {
  assert.deepEqual(wrapSecretsFromEnv({}), []);
  assert.deepEqual(wrapSecretsFromEnv({ DASHBOARD_PASSWORD: "board" }), ["board"]);
  assert.deepEqual(wrapSecretsFromEnv({ WATCH_SECRET: "wrap", DASHBOARD_PASSWORD: "board" }), ["wrap", "board"]);
  assert.deepEqual(wrapSecretsFromEnv({ WATCH_SECRET: "same", DASHBOARD_PASSWORD: "same" }), ["same"]);
  assert.deepEqual(wrapSecretsFromEnv({ WATCH_SECRET: "  " }), []);
});

test("wrapPassword round-trips and rejects the wrong secret", () => {
  const stored = wrapPassword("aaaa bbbb", "board");
  assert.match(stored, /^v2:/);
  assert.equal(unwrapPassword(stored, ["board"]), "aaaa bbbb");
  assert.equal(unwrapPassword(stored, ["other", "board"]), "aaaa bbbb");
  assert.equal(unwrapPassword("plaintext", ["board"]), "plaintext");
  assert.throws(() => unwrapPassword(stored, ["other"]), /Check WATCH_SECRET/);
  assert.throws(() => unwrapPassword(stored, []), /DASHBOARD_PASSWORD/);
  assert.throws(() => unwrapPassword("v2:a.b.c", ["board"]), /Could not decrypt/);
});

test("wrapPassword salts every row, so equal passwords do not share ciphertext or a key", () => {
  const first = wrapPassword("same", "board");
  const second = wrapPassword("same", "board");
  assert.notEqual(first, second);
  assert.notEqual(first.split(".")[0], second.split(".")[0]);
  assert.equal(unwrapPassword(second, ["board"]), "same");
});

test("v1 rows still open, and isCurrentWrap marks them for rewrapping", () => {
  const legacy = wrapV1("aaaa bbbb", "board");
  assert.equal(unwrapPassword(legacy, ["board"]), "aaaa bbbb");
  assert.equal(unwrapPassword(legacy, ["rotated", "board"]), "aaaa bbbb");
  assert.throws(() => unwrapPassword(legacy, ["rotated"]), /Check WATCH_SECRET/);

  assert.equal(isCurrentWrap(legacy, "board"), false);
  assert.equal(isCurrentWrap("plaintext", "board"), false);
  assert.equal(isCurrentWrap(wrapPassword("aaaa", "board"), "board"), true);
  assert.equal(isCurrentWrap(wrapPassword("aaaa", "board"), "rotated"), false);
});

/** The pre-scrypt format, written here so the compatibility path stays covered. */
function wrapV1(plain: string, secret: string): string {
  const key = createHash("sha256").update("wwatch-app-password-v1").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1:" + iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
