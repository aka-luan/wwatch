import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyFilterState,
  filterEmptyHeading,
  filterSites,
  filtersActive,
  removeSecondaryFilter,
  rowMatchesSecondary,
  secondaryFilterCounts,
  statusFilterCounts,
  toggleSecondaryFilter,
} from "./site-filters.ts";
import type { Finding, OverviewRow, ScanSnapshot, Site } from "./types.ts";

function site(id: string, name: string, origin: string): Site {
  return { id, name, origin };
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

function row(
  partial: {
    id?: string;
    name?: string;
    origin?: string;
    findings?: Finding[];
    latest?: ScanSnapshot | null;
    rollup?: OverviewRow["rollup"];
    running?: OverviewRow["running"];
  } = {},
): OverviewRow {
  const siteRow = site(partial.id ?? "s1", partial.name ?? "Bakery", partial.origin ?? "https://bakery.example");
  const latest =
    partial.latest !== undefined
      ? partial.latest
      : partial.findings
        ? snapshot(partial.findings, partial.rollup === "down" ? "down" : partial.rollup === "auth_failed" ? "auth_failed" : "ok")
        : null;
  return {
    site: siteRow,
    latest,
    running: partial.running ?? null,
    rollup: partial.rollup ?? (latest ? latest.rollup : "never"),
  };
}

function finding(kind: string, severity: Finding["severity"], title = kind): Finding {
  return { kind, severity, title, detail: "" };
}

test("status counts bucket critical, attention, and healthy; unknown only in all", () => {
  const rows = [
    row({ id: "1", findings: [finding("exposed_path", "crit")] }),
    row({ id: "2", findings: [finding("plugin_update", "warn")] }),
    row({ id: "3", findings: [] }),
    row({ id: "4", latest: null, rollup: "never" }),
    row({ id: "5", findings: [finding("tls_expiring", "warn")] }),
  ];
  assert.deepEqual(statusFilterCounts(rows), {
    all: 5,
    critical: 1,
    attention: 2,
    healthy: 1,
  });
});

test("search matches site name and hostname", () => {
  const rows = [
    row({ id: "1", name: "Bakery", origin: "https://bakery.example" }),
    row({ id: "2", name: "Cafe", origin: "https://cafe.shop" }),
    row({ id: "3", name: "Other", origin: "https://bakery-mirror.test" }),
  ];
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), query: "bakery" }).map((item) => item.site.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), query: "cafe.shop" }).map((item) => item.site.id),
    ["2"],
  );
});

test("primary status filter isolates sites", () => {
  const rows = [
    row({ id: "crit", findings: [finding("down", "crit", "Scan failed")] }),
    row({ id: "attn", findings: [finding("plugin_update", "warn")] }),
    row({ id: "ok", findings: [] }),
    row({ id: "unk", latest: null }),
  ];
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), status: "critical" }).map((item) => item.site.id),
    ["crit"],
  );
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), status: "attention" }).map((item) => item.site.id),
    ["attn"],
  );
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), status: "healthy" }).map((item) => item.site.id),
    ["ok"],
  );
  assert.equal(filterSites(rows, emptyFilterState()).length, 4);
});

test("secondary filters detect updates, security, tls, and scan failed", () => {
  const updates = row({ id: "u", findings: [finding("plugin_update", "warn")] });
  const security = row({ id: "s", findings: [finding("xmlrpc_open", "warn")] });
  const tls = row({ id: "t", findings: [finding("tls_expiring", "warn")] });
  const failed = row({ id: "f", findings: [finding("down", "crit", "Scan failed")], rollup: "down" });
  const healthy = row({ id: "h", findings: [] });

  assert.equal(rowMatchesSecondary(updates, "updates"), true);
  assert.equal(rowMatchesSecondary(security, "security"), true);
  assert.equal(rowMatchesSecondary(tls, "tls_expiring"), true);
  assert.equal(rowMatchesSecondary(failed, "scan_failed"), true);
  assert.equal(rowMatchesSecondary(healthy, "updates"), false);
  assert.equal(rowMatchesSecondary(healthy, "security"), false);

  const counts = secondaryFilterCounts([updates, security, tls, failed, healthy]);
  assert.deepEqual(counts, {
    updates: 1,
    security: 1,
    tls_expiring: 1,
    scan_failed: 1,
  });
});

test("security secondary ignores info-only security findings", () => {
  const infoOnly = row({ findings: [finding("xmlrpc_open", "info")] });
  assert.equal(rowMatchesSecondary(infoOnly, "security"), false);
});

test("search and filters combine with AND", () => {
  const rows = [
    row({
      id: "1",
      name: "Bakery",
      findings: [finding("plugin_update", "warn"), finding("exposed_path", "crit")],
    }),
    row({
      id: "2",
      name: "Bakery West",
      findings: [finding("plugin_update", "warn")],
    }),
    row({
      id: "3",
      name: "Cafe",
      findings: [finding("exposed_path", "crit")],
    }),
  ];
  const filtered = filterSites(rows, {
    query: "bakery",
    status: "critical",
    secondary: ["updates"],
  });
  assert.deepEqual(
    filtered.map((item) => item.site.id),
    ["1"],
  );
});

test("multiple secondary filters require every selected facet", () => {
  const rows = [
    row({
      id: "both",
      findings: [finding("plugin_update", "warn"), finding("exposed_path", "warn")],
    }),
    row({ id: "updates", findings: [finding("plugin_update", "warn")] }),
    row({ id: "security", findings: [finding("exposed_path", "warn")] }),
  ];
  assert.deepEqual(
    filterSites(rows, { ...emptyFilterState(), secondary: ["updates", "security"] }).map((item) => item.site.id),
    ["both"],
  );
});

test("filter empty headings name the active status filter", () => {
  assert.equal(filterEmptyHeading(emptyFilterState()), "No sites match these filters");
  assert.equal(filterEmptyHeading({ ...emptyFilterState(), status: "critical" }), "No critical sites");
  assert.equal(
    filterEmptyHeading({ ...emptyFilterState(), status: "attention" }),
    "No sites needing attention",
  );
  assert.equal(filterEmptyHeading({ ...emptyFilterState(), status: "healthy" }), "No healthy sites");
  assert.equal(
    filterEmptyHeading({ ...emptyFilterState(), status: "critical", query: "bakery" }),
    "No sites match these filters",
  );
  assert.equal(
    filterEmptyHeading({ ...emptyFilterState(), status: "healthy", secondary: ["updates"] }),
    "No sites match these filters",
  );
});

test("filtersActive and secondary toggle helpers", () => {
  assert.equal(filtersActive(emptyFilterState()), false);
  assert.equal(filtersActive({ ...emptyFilterState(), query: "x" }), true);
  assert.equal(filtersActive({ ...emptyFilterState(), status: "critical" }), true);
  assert.equal(filtersActive({ ...emptyFilterState(), secondary: ["updates"] }), true);

  assert.deepEqual(toggleSecondaryFilter([], "updates"), ["updates"]);
  assert.deepEqual(toggleSecondaryFilter(["updates"], "security"), ["updates", "security"]);
  assert.deepEqual(toggleSecondaryFilter(["updates", "security"], "updates"), ["security"]);
  assert.deepEqual(removeSecondaryFilter(["updates", "security"], "security"), ["updates"]);
});
