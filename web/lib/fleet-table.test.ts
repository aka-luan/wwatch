import assert from "node:assert/strict";
import { test } from "node:test";
import { fleetRow, fleetTable, issueFindings, tlsDaysLeftOf } from "./fleet-table.ts";
import type { Finding, HelperInfo, OverviewRow } from "./types.ts";

const NOW = "2026-01-01T00:01:00.000Z";

function finding(kind: string, title: string, extra: Partial<Finding> = {}): Finding {
  return { kind, severity: "warn", title, detail: "", ...extra };
}

function row(
  id: string,
  findings: Finding[],
  options: { helper?: HelperInfo | null; coreVersion?: string | null; running?: boolean } = {},
): OverviewRow {
  return {
    site: { id, name: `Site ${id}`, origin: `https://${id}.example.com` },
    latest: {
      id: `scan-${id}`,
      siteId: id,
      startedAt: NOW,
      finishedAt: new Date().toISOString(),
      rollup: "degraded",
      coreVersion: options.coreVersion ?? "6.8.1",
      plugins: [],
      findings,
      helper: options.helper === undefined ? { kind: "installed", version: "1.3.0", capabilities: ["update"] } : options.helper,
    },
    running: options.running ? { id: "run", startedAt: NOW } : null,
    rollup: "degraded",
  };
}

test("tlsDaysLeftOf reads daysLeft only from a tls_expiring finding", () => {
  assert.equal(tlsDaysLeftOf([finding("tls_expiring", "TLS expires in 9 days", { daysLeft: 9 })]), 9);
  assert.equal(tlsDaysLeftOf([finding("exposed_path", "readme.html is public")]), null);
  assert.equal(tlsDaysLeftOf([]), null);
});

test("issueFindings excludes updates and info findings", () => {
  const findings = [
    finding("plugin_update", "Elementor 3.20.2 → 4.2.2"),
    finding("exposed_path", "readme.html is public"),
    finding("wp_debug", "Debug mode", { severity: "info" }),
  ];
  assert.deepEqual(issueFindings(findings).map((item) => item.kind), ["exposed_path"]);
});

test("fleetRow surfaces the primary issue with an overflow count, separate from updates", () => {
  const cell = fleetRow(
    row("a", [
      finding("exposed_path", "readme.html is public"),
      finding("license.txt", "license.txt is public"),
      finding("xmlrpc_open", "xmlrpc.php is open"),
      finding("plugin_update", "Elementor 3.20.2 → 4.2.2", { plugin: "elementor/elementor.php" }),
    ]),
  );
  assert.equal(cell.finding, "readme.html is public");
  assert.equal(cell.findingExtra, "+2");
  assert.equal(cell.updates, 1);
  assert.equal(cell.status, "attention");
  assert.equal(cell.statusLabel, "Warning");
  assert.equal(cell.hostname, "a.example.com");
  assert.equal(cell.coreVersion, "6.8.1");
});

test("fleetRow marks a row updatable only when the helper can update", () => {
  const pending = [finding("plugin_update", "Elementor 3.20.2 → 4.2.2", { plugin: "elementor/elementor.php" })];
  assert.equal(fleetRow(row("a", pending)).updatable, true);
  assert.equal(fleetRow(row("b", pending, { helper: { kind: "missing" } })).updatable, false);
  assert.equal(fleetRow(row("c", pending, { helper: { kind: "installed", version: "1", capabilities: ["login"] } })).updatable, false);
  assert.equal(fleetRow(row("d", [])).updatable, false);
});

test("fleetRow reports a never-scanned site as unknown", () => {
  const cell = fleetRow({
    site: { id: "n", name: "New", origin: "https://new.example.com" },
    latest: null,
    running: null,
    rollup: "never",
  });
  assert.equal(cell.status, "unknown");
  assert.equal(cell.statusLabel, "Never scanned");
  assert.equal(cell.finding, null);
  assert.equal(cell.coreVersion, null);
});

test("fleetTable splits attention from healthy and totals the stat strip", () => {
  const table = fleetTable([
    row("crit", [finding("down", "Site unreachable (HTTP 502)", { severity: "crit" })]),
    row("warn", [
      finding("tls_expiring", "TLS expires in 9 days", { daysLeft: 9 }),
      finding("plugin_update", "Akismet 5.0 → 5.1", { plugin: "akismet/akismet.php" }),
    ]),
    row("ok", []),
  ]);
  assert.equal(table.counts.critical, 1);
  assert.equal(table.counts.attention, 1);
  assert.equal(table.counts.healthy, 1);
  assert.equal(table.counts.updates, 1);
  assert.equal(table.needsAttention.length, 2);
  assert.deepEqual(table.healthy.map((item) => item.row.site.id), ["ok"]);
});
