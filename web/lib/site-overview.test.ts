import assert from "node:assert/strict";
import { test } from "node:test";
import { siteOverview, siteRowCopy } from "./site-overview.ts";
import type { Finding, OverviewRow, ScanSnapshot, Site } from "./types.ts";

const site: Site = { id: "s1", name: "Client A", origin: "https://example.com" };

function row(overrides: Partial<OverviewRow> & { findings?: Finding[]; rollup?: ScanSnapshot["rollup"] }): OverviewRow {
  const findings = overrides.findings;
  const latest =
    findings === undefined && overrides.latest === undefined
      ? null
      : overrides.latest !== undefined
        ? overrides.latest
        : snapshot(findings ?? [], overrides.rollup ?? "ok");
  return {
    site,
    latest,
    running: overrides.running ?? null,
    rollup: overrides.rollup ?? (latest ? latest.rollup : "never"),
  };
}

function snapshot(findings: Finding[], rollup: ScanSnapshot["rollup"] = "ok"): ScanSnapshot {
  return {
    id: "c1",
    siteId: "s1",
    startedAt: "t0",
    finishedAt: "t1",
    rollup,
    coreVersion: "6.7.1",
    plugins: [],
    findings,
    helper: null,
  };
}

function finding(kind: string, severity: Finding["severity"], title: string): Finding {
  return { kind, severity, title, detail: "" };
}

test("unknown when there is no completed scan", () => {
  const overview = siteOverview(row({ latest: null, running: null, rollup: "never" }));
  assert.equal(overview.status, "unknown");
  assert.equal(overview.primaryLabel, "Not scanned yet");
  assert.equal(overview.emphasizePrimary, true);
  assert.equal(overview.finishedAt, null);
});

test("unknown while the first scan is still running", () => {
  const overview = siteOverview(row({ latest: null, running: { id: "j1", startedAt: "t0" }, rollup: "running" }));
  assert.equal(overview.status, "unknown");
  assert.equal(overview.primaryLabel, "Scan in progress");
});

test("healthy when the latest scan has no actionable findings", () => {
  const overview = siteOverview(
    row({
      findings: [finding("xmlrpc_open", "info", "xmlrpc.php accepts requests")],
      rollup: "ok",
    }),
  );
  assert.equal(overview.status, "healthy");
  assert.equal(overview.primaryLabel, "No action required");
  assert.equal(overview.emphasizePrimary, false);
  assert.equal(overview.extra, null);
});

test("attention for updates and other warnings", () => {
  const overview = siteOverview(
    row({
      findings: [
        finding("plugin_update", "warn", "Akismet 1.0 → 1.1"),
        finding("plugin_update", "warn", "Hello Dolly 1.0 → 1.1"),
        finding("broken_link", "warn", "Broken link (404)"),
      ],
      rollup: "degraded",
    }),
  );
  assert.equal(overview.status, "attention");
  assert.equal(overview.primaryLabel, "Akismet 1.0 → 1.1");
  assert.equal(overview.emphasizePrimary, true);
  assert.equal(overview.extra, "2 updates");
});

test("critical for security exposure even when rollup is only degraded", () => {
  const overview = siteOverview(
    row({
      findings: [
        finding("plugin_update", "warn", "Akismet 1.0 → 1.1"),
        finding("plugin_update", "warn", "Hello Dolly 1.0 → 1.1"),
        finding("plugin_update", "warn", "Jetpack 1.0 → 1.1"),
        finding("plugin_update", "warn", "Yoast 1.0 → 1.1"),
        finding("exposed_path", "crit", "debug.log is public"),
      ],
      rollup: "degraded",
    }),
  );
  assert.equal(overview.status, "critical");
  assert.equal(overview.primaryLabel, "debug.log is public");
  assert.equal(overview.extra, "4 updates");
});

test("critical for reachability failure", () => {
  const overview = siteOverview(
    row({
      findings: [finding("down", "crit", "Site did not respond")],
      rollup: "down",
    }),
  );
  assert.equal(overview.status, "critical");
  assert.equal(overview.primaryLabel, "Site did not respond");
  assert.equal(overview.extra, null);
});

test("keeps the last completed status while a new scan runs", () => {
  const overview = siteOverview(
    row({
      findings: [],
      rollup: "ok",
      running: { id: "j2", startedAt: "t2" },
    }),
  );
  assert.equal(overview.status, "healthy");
  assert.equal(overview.primaryLabel, "No action required");
  assert.equal(overview.running, true);
  assert.equal(overview.finishedAt, "t1");
});

test("omits a redundant 1 update extra when that update is already the primary", () => {
  const overview = siteOverview(
    row({
      findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
      rollup: "degraded",
    }),
  );
  assert.equal(overview.primaryLabel, "Akismet 1.0 → 1.1");
  assert.equal(overview.extra, null);
});

test("row copy keeps the primary finding on its own line for sites that need work", () => {
  const overview = siteOverview(
    row({
      findings: [
        finding("exposed_path", "crit", "debug.log is public"),
        finding("plugin_update", "warn", "Akismet 1.0 → 1.1"),
        finding("plugin_update", "warn", "Hello Dolly 1.0 → 1.1"),
        finding("plugin_update", "warn", "Jetpack 1.0 → 1.1"),
        finding("plugin_update", "warn", "Yoast 1.0 → 1.1"),
      ],
      rollup: "degraded",
    }),
  );
  assert.deepEqual(siteRowCopy(overview, () => "8m ago"), {
    finding: "debug.log is public",
    meta: "4 updates · Last scanned 8m ago",
  });
});

test("row copy keeps healthy status off the finding line", () => {
  const healthy = siteOverview(row({ findings: [], rollup: "ok" }));
  assert.deepEqual(siteRowCopy(healthy, () => "7m ago"), {
    finding: null,
    meta: "Last scanned 7m ago",
  });
});

test("row copy keeps unknown reasons on the finding line", () => {
  const unknown = siteOverview(row({ latest: null, running: null, rollup: "never" }));
  assert.deepEqual(siteRowCopy(unknown, () => "7m ago"), {
    finding: "Not scanned yet",
    meta: "",
  });
  const scanning = siteOverview(row({ latest: null, running: { id: "j1", startedAt: "t0" }, rollup: "running" }));
  assert.deepEqual(siteRowCopy(scanning, () => "7m ago"), {
    finding: "Scan in progress",
    meta: "",
  });
});

test("row copy keeps prior results visible while a refresh scan runs", () => {
  const overview = siteOverview(
    row({
      findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
      rollup: "degraded",
      running: { id: "j2", startedAt: "t2" },
    }),
  );
  assert.deepEqual(siteRowCopy(overview, () => "8m ago", () => "Aug 15, 10:42"), {
    finding: "Akismet 1.0 → 1.1",
    meta: "Showing results from Aug 15, 10:42",
  });
});
