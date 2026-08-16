import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareVersions,
  displayRollup,
  findingCounts,
  helperCan,
  helperFromCapabilities,
  parseHelperInfo,
  parseOrigin,
  parsePluginRef,
  parseRepairTarget,
  parseThemeSlug,
  parseUpdateTarget,
  pluginSlug,
  rollupOf,
  scanSummary,
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

test("parseThemeSlug rejects paths", () => {
  assert.equal(parseThemeSlug("twentytwentyfour"), "twentytwentyfour");
  assert.throws(() => parseThemeSlug("../evil"), /stylesheet/);
  assert.throws(() => parseThemeSlug("a/b"), /stylesheet/);
});

test("parseUpdateTarget reads plugin, theme, core, and all", () => {
  assert.deepEqual(parseUpdateTarget({ kind: "core" }), { kind: "core" });
  assert.deepEqual(parseUpdateTarget({ kind: "all" }), { kind: "all" });
  assert.deepEqual(parseUpdateTarget({ kind: "plugin", plugin: "akismet/akismet.php" }), {
    kind: "plugin",
    plugin: "akismet/akismet.php",
  });
  assert.deepEqual(parseUpdateTarget({ kind: "theme", theme: "twentytwentyfour" }), {
    kind: "theme",
    theme: "twentytwentyfour",
  });
  assert.throws(() => parseUpdateTarget({ kind: "plugins" }), /plugin, theme, core, or all/);
});

test("helperFromCapabilities ignores unknown capability names", () => {
  assert.deepEqual(helperFromCapabilities({ version: "1.1.0", capabilities: ["login", "health", "update"] }), {
    kind: "installed",
    version: "1.1.0",
    capabilities: ["login", "update"],
  });
  assert.deepEqual(
    helperFromCapabilities({ version: "1.2.0", capabilities: ["login", "update", "repair"] }),
    {
      kind: "installed",
      version: "1.2.0",
      capabilities: ["login", "update", "repair"],
    },
  );
  assert.equal(parseHelperInfo({ kind: "missing" })?.kind, "missing");
  assert.equal(helperCan({ kind: "missing" }, "update"), false);
  assert.equal(
    helperCan({ kind: "installed", version: "1.0.0", capabilities: ["login"] }, "update"),
    false,
  );
  assert.equal(
    helperCan({ kind: "installed", version: "1.1.0", capabilities: ["login", "update"] }, "update"),
    true,
  );
  assert.equal(
    helperCan({ kind: "installed", version: "1.1.0", capabilities: ["login", "update"] }, "repair"),
    false,
  );
  assert.equal(
    helperCan({ kind: "installed", version: "1.2.0", capabilities: ["login", "update", "repair"] }, "repair"),
    true,
  );
});

test("parseRepairTarget allowlists exposed paths and xmlrpc", () => {
  assert.deepEqual(parseRepairTarget({ kind: "xmlrpc" }), { kind: "xmlrpc" });
  assert.deepEqual(parseRepairTarget({ kind: "exposed_path", path: "/debug.log" }), {
    kind: "exposed_path",
    path: "/debug.log",
  });
  assert.deepEqual(parseRepairTarget({ kind: "exposed_path", path: "/wp-content/debug.log" }), {
    kind: "exposed_path",
    path: "/wp-content/debug.log",
  });
  assert.deepEqual(parseRepairTarget({ kind: "exposed_path", path: "/wp-config.php.bak" }), {
    kind: "exposed_path",
    path: "/wp-config.php.bak",
  });
  assert.throws(() => parseRepairTarget({ kind: "exposed_path", path: "/wp-config.php" }), /cannot be repaired/);
  assert.throws(() => parseRepairTarget({ kind: "exposed_path", path: "/.git/HEAD" }), /cannot be repaired/);
  assert.throws(() => parseRepairTarget({ kind: "exposed_path", path: "../wp-config.php.bak" }), /cannot be repaired/);
  assert.throws(
    () => parseRepairTarget({ kind: "exposed_path", path: "/wp-config.php.bak/../wp-config.php" }),
    /cannot be repaired/,
  );
  assert.throws(() => parseRepairTarget({ kind: "plugin" }), /exposed_path or xmlrpc/);
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
  const checksums: Finding = {
    kind: "core_checksums",
    severity: "warn",
    title: "2 core files do not match wordpress.org checksums",
    detail: "",
    matched: 10,
    mismatched: 2,
    skipped: 0,
  };
  assert.equal(rollupOf([checksums]), "degraded");
  const hidden: Finding = {
    kind: "hidden_code",
    severity: "info",
    title: "Drop-in object-cache.php",
    detail: "",
    muPlugins: [],
    dropins: ["object-cache.php"],
  };
  assert.equal(rollupOf([hidden]), "ok");
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
    helper: null,
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

test("scanSummary keeps rollup, time, and counts without findings", () => {
  const summary = scanSummary({
    id: "c1" as never,
    siteId: "s1" as never,
    startedAt: "t0",
    finishedAt: "t1",
    rollup: "degraded",
    coreVersion: "6.7.1",
    plugins: [],
    findings: [
      { kind: "down", severity: "crit", title: "down", detail: "" },
      { kind: "rate_limited", severity: "warn", title: "rl", detail: "" },
    ],
    helper: null,
  });
  assert.deepEqual(summary, {
    id: "c1",
    finishedAt: "t1",
    rollup: "degraded",
    counts: { crit: 1, warn: 1, info: 0, updates: 0 },
  });
});

test("scanSummary counts plugin, theme, and core updates separately from severity", () => {
  const summary = scanSummary({
    id: "c2" as never,
    siteId: "s1" as never,
    startedAt: "t0",
    finishedAt: "t1",
    rollup: "degraded",
    coreVersion: "6.7.1",
    plugins: [],
    findings: [
      { kind: "exposed_path", severity: "crit", title: "debug.log", detail: "", path: "/debug.log" },
      {
        kind: "plugin_update",
        severity: "warn",
        title: "Akismet",
        detail: "",
        plugin: "akismet/akismet.php" as never,
        installed: "1.0",
        latest: "1.1",
      },
      {
        kind: "theme_update",
        severity: "warn",
        title: "Twenty Twenty-Four",
        detail: "",
        theme: "twentytwentyfour",
        installed: "1.0",
        latest: "1.1",
      },
      {
        kind: "core_update",
        severity: "warn",
        title: "WordPress",
        detail: "",
        installed: "6.7.1",
        latest: "6.7.2",
      },
    ],
    helper: null,
  });
  assert.deepEqual(summary.counts, { crit: 1, warn: 3, info: 0, updates: 3 });
});
