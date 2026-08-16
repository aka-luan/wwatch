import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD_STATUS_ORDER, HEALTHY_COLLAPSE_AFTER, compareBoardSites, siteBoard } from "./site-board.ts";
import type { Finding, OverviewRow, ScanSnapshot, Site } from "./types.ts";

function site(id: string, name: string, origin = `https://${id}.example`): Site {
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

function finding(kind: string, severity: Finding["severity"], title: string): Finding {
  return { kind, severity, title, detail: "" };
}

function row(id: string, name: string, overrides: Partial<OverviewRow> & { findings?: Finding[] } = {}): OverviewRow {
  const findings = overrides.findings;
  const latest =
    findings === undefined && overrides.latest === undefined
      ? snapshot([])
      : overrides.latest !== undefined
        ? overrides.latest
        : snapshot(findings ?? [], overrides.rollup === "degraded" || overrides.rollup === "down" ? overrides.rollup : "ok");
  return {
    site: site(id, name),
    latest,
    running: overrides.running ?? null,
    rollup: overrides.rollup ?? (latest ? latest.rollup : "never"),
  };
}

test("board status order puts unknown ahead of healthy", () => {
  assert.deepEqual([...BOARD_STATUS_ORDER], ["critical", "attention", "unknown", "healthy"]);
});

test("groups unknown with sites that need attention and keeps healthy separate", () => {
  const board = siteBoard([
    row("h1", "Healthy Site", { findings: [] }),
    row("u1", "New Site", { latest: null, running: null, rollup: "never" }),
    row("a1", "Updates Site", {
      findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
      rollup: "degraded",
    }),
    row("c1", "Exposed Site", {
      findings: [finding("exposed_path", "crit", "debug.log is public")],
      rollup: "degraded",
    }),
  ]);
  assert.deepEqual(
    board.needsAttention.map((item) => item.row.site.name),
    ["Exposed Site", "Updates Site", "New Site"],
  );
  assert.deepEqual(
    board.needsAttention.map((item) => item.overview.status),
    ["critical", "attention", "unknown"],
  );
  assert.deepEqual(
    board.healthy.map((item) => item.row.site.name),
    ["Healthy Site"],
  );
  assert.equal(board.allHealthy, false);
  assert.equal(board.collapseHealthy, false);
});

test("orders each status group by name then id", () => {
  const board = siteBoard([
    row("c-b", "zeta", { findings: [finding("down", "crit", "Site did not respond")], rollup: "down" }),
    row("c-a", "Alpha", { findings: [finding("down", "crit", "Site did not respond")], rollup: "down" }),
    row("a-b", "beta", { findings: [finding("tls_expiring", "warn", "TLS expires in 12 days")], rollup: "degraded" }),
    row("a-a", "Beta", { findings: [finding("tls_expiring", "warn", "TLS expires in 12 days")], rollup: "degraded" }),
    row("h-2", "same", { findings: [] }),
    row("h-1", "same", { findings: [] }),
  ]);
  assert.deepEqual(
    board.needsAttention.map((item) => item.row.site.id),
    ["c-a", "c-b", "a-a", "a-b"],
  );
  assert.deepEqual(
    board.healthy.map((item) => item.row.site.id),
    ["h-1", "h-2"],
  );
});

test("orders same-status sites by most recent activity first", () => {
  const board = siteBoard([
    row("a1", "Older", {
      findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
      rollup: "degraded",
      latest: {
        id: "c-old",
        siteId: "a1",
        startedAt: "2024-01-01T00:00:00.000Z",
        finishedAt: "2024-01-01T00:00:00.000Z",
        rollup: "degraded",
        coreVersion: "6.7.1",
        plugins: [],
        findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
        helper: null,
      },
    }),
    row("a2", "Newer", {
      findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
      rollup: "degraded",
      latest: {
        id: "c-new",
        siteId: "a2",
        startedAt: "2024-06-01T00:00:00.000Z",
        finishedAt: "2024-06-01T00:00:00.000Z",
        rollup: "degraded",
        coreVersion: "6.7.1",
        plugins: [],
        findings: [finding("plugin_update", "warn", "Akismet 1.0 → 1.1")],
        helper: null,
      },
    }),
  ]);
  assert.deepEqual(
    board.needsAttention.map((item) => item.row.site.id),
    ["a2", "a1"],
  );
});

test("compareBoardSites is deterministic for equal names", () => {
  const a = {
    row: row("b", "Client"),
    overview: {
      status: "healthy" as const,
      primaryLabel: "",
      emphasizePrimary: false,
      extra: null,
      finishedAt: null,
      running: false,
      staleLabel: null,
    },
  };
  const b = {
    row: row("a", "Client"),
    overview: {
      status: "healthy" as const,
      primaryLabel: "",
      emphasizePrimary: false,
      extra: null,
      finishedAt: null,
      running: false,
      staleLabel: null,
    },
  };
  assert.ok(compareBoardSites(a, b) > 0);
  assert.ok(compareBoardSites(b, a) < 0);
  assert.equal(compareBoardSites(a, a), 0);
});

test("all-healthy fleets use the positive empty state and collapse after the shared threshold", () => {
  const few = siteBoard([row("h1", "A", { findings: [] }), row("h2", "B", { findings: [] })]);
  assert.equal(few.allHealthy, true);
  assert.equal(few.collapseHealthy, false);
  assert.equal(few.needsAttention.length, 0);

  const many = siteBoard(
    Array.from({ length: HEALTHY_COLLAPSE_AFTER + 1 }, (_, index) =>
      row(`h${index}`, `Site ${String(index).padStart(2, "0")}`, { findings: [] }),
    ),
  );
  assert.equal(many.allHealthy, true);
  assert.equal(many.healthy.length, HEALTHY_COLLAPSE_AFTER + 1);
  assert.equal(many.collapseHealthy, true);
});

test("does not treat an empty fleet as all healthy", () => {
  const board = siteBoard([]);
  assert.equal(board.allHealthy, false);
  assert.equal(board.collapseHealthy, false);
});

test("does not mutate the input list", () => {
  const rows = [
    row("h1", "Healthy", { findings: [] }),
    row("c1", "Critical", { findings: [finding("down", "crit", "Site did not respond")], rollup: "down" }),
  ];
  const before = rows.map((item) => item.site.id);
  siteBoard(rows);
  assert.deepEqual(
    rows.map((item) => item.site.id),
    before,
  );
});
