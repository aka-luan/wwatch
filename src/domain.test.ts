import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareVersions,
  displayRollup,
  findingCounts,
  parseOrigin,
  parsePluginRef,
  pluginSlug,
  rollupOf,
  type Finding,
} from "./domain.js";

test("parseOrigin keeps scheme and host, drops path", () => {
  assert.equal(parseOrigin("https://bakery.example/wp-admin/"), "https://bakery.example");
});

test("parseOrigin allows http only for localhost", () => {
  assert.equal(parseOrigin("http://localhost:8080"), "http://localhost:8080");
  assert.throws(() => parseOrigin("http://bakery.example"), /https/);
});

test("parseOrigin rejects credentials in the URL", () => {
  assert.throws(() => parseOrigin("https://user:pass@bakery.example"), /credentials/);
});

test("parseOrigin rejects link-local and cloud metadata hosts", () => {
  assert.throws(() => parseOrigin("https://169.254.169.254"), /metadata/);
  assert.throws(() => parseOrigin("https://metadata.google.internal"), /metadata/);
  assert.throws(() => parseOrigin("https://[fd00:ec2::254]"), /metadata/);
  assert.throws(() => parseOrigin("https://[fe80::1]"), /metadata/);
  assert.equal(parseOrigin("https://bakery.example"), "https://bakery.example");
  assert.equal(parseOrigin("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
});

test("pluginSlug uses the directory, not the file", () => {
  const ref = parsePluginRef("woocommerce/woocommerce.php");
  assert.equal(pluginSlug(ref), "woocommerce");
});

test("compareVersions does not treat 6.4.10 as behind 6.4.2", () => {
  assert.equal(compareVersions("6.4.2", "6.4.10"), "behind");
  assert.equal(compareVersions("6.4.10", "6.4.2"), "ahead");
  assert.equal(compareVersions("6.4.2", "6.4.2"), "current");
  assert.equal(compareVersions("nightly", "6.4.2"), "incomparable");
});

test("rollupOf prefers down over auth_failed over degraded", () => {
  const down: Finding = { kind: "down", severity: "crit", title: "Down", detail: "" };
  const auth: Finding = { kind: "auth_failed", severity: "crit", title: "Auth", detail: "" };
  const warn: Finding = {
    kind: "plugin_update",
    severity: "warn",
    title: "Update",
    detail: "",
    plugin: parsePluginRef("akismet/akismet.php"),
    installed: "1.0",
    latest: "1.1",
  };
  assert.equal(rollupOf([warn, down, auth]), "down");
  assert.equal(rollupOf([warn, auth]), "auth_failed");
  assert.equal(rollupOf([warn]), "degraded");
  assert.equal(rollupOf([]), "ok");
});

test("displayRollup keeps the last finished rollup while a scan runs", () => {
  assert.equal(displayRollup({ latest: null, running: { id: "s1" as never, startedAt: "t" } }), "running");
  assert.equal(displayRollup({ latest: null, running: null }), "never");
  const latest = {
    id: "c1" as never,
    siteId: "s1" as never,
    startedAt: "t",
    finishedAt: "t",
    rollup: "degraded" as const,
    coreVersion: "6.7.1",
    plugins: [],
    findings: [],
  };
  assert.equal(displayRollup({ latest, running: { id: "s2" as never, startedAt: "t" } }), "degraded");
});

test("findingCounts tallies by severity", () => {
  const findings: Finding[] = [
    { kind: "xmlrpc_open", severity: "info", title: "xmlrpc", detail: "" },
    { kind: "rate_limited", severity: "warn", title: "rl", detail: "" },
    { kind: "down", severity: "crit", title: "down", detail: "" },
  ];
  assert.deepEqual(findingCounts(findings), { crit: 1, warn: 1, info: 1 });
});
