import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isComparableScan,
  isIncompleteScan,
  previousComparableScan,
  scanChanges,
  scanCountsLine,
  scanHistoryEntries,
  scansForTimeline,
} from "./scan-history.ts";
import type { ScanSnapshot, ScanSummary } from "./types.ts";

function scan(
  id: string,
  rollup: ScanSummary["rollup"],
  counts: Partial<ScanSummary["counts"]> = {},
): ScanSummary {
  return {
    id,
    finishedAt: `2026-08-1${id}T12:00:00.000Z`,
    rollup,
    counts: {
      crit: 0,
      warn: 0,
      info: 0,
      updates: 0,
      ...counts,
    },
  };
}

test("ok and degraded scans are comparable; down and auth_failed are not", () => {
  assert.equal(isComparableScan(scan("1", "ok")), true);
  assert.equal(isComparableScan(scan("1", "degraded")), true);
  assert.equal(isComparableScan(scan("1", "down")), false);
  assert.equal(isComparableScan(scan("1", "auth_failed")), false);
  assert.equal(isIncompleteScan(scan("1", "down")), true);
  assert.equal(isIncompleteScan(scan("1", "auth_failed")), true);
  assert.equal(isIncompleteScan(scan("1", "ok")), false);
});

test("count line prefers critical, then remaining issues, then updates", () => {
  assert.equal(scanCountsLine({ crit: 1, warn: 3, info: 0, updates: 3 }), "1 critical · 3 updates");
  assert.equal(scanCountsLine({ crit: 2, warn: 5, info: 0, updates: 3 }), "2 critical · 2 issues · 3 updates");
  assert.equal(scanCountsLine({ crit: 0, warn: 1, info: 0, updates: 0 }), "1 issue");
  assert.equal(scanCountsLine({ crit: 0, warn: 0, info: 2, updates: 0 }), null);
});

test("changes skip incomplete scans and compare through them to the next completed scan", () => {
  const history = [
    scan("5", "degraded", { crit: 1, warn: 3, updates: 3 }),
    scan("4", "down", { crit: 1 }),
    scan("3", "auth_failed", { crit: 1 }),
    scan("2", "degraded", { crit: 2, warn: 4, updates: 4 }),
    scan("1", "ok"),
  ];
  const entries = scanHistoryEntries(history);
  assert.equal(entries[0]?.outcome, "completed");
  assert.deepEqual(
    entries[0]?.changes.map((change) => change.text),
    ["↓ 1 critical finding", "↓ 2 issues", "1 update resolved"],
  );
  assert.equal(entries[1]?.outcome, "failed");
  assert.deepEqual(entries[1]?.changes, []);
  assert.equal(entries[1]?.countsLine, null);
  assert.equal(entries[2]?.outcome, "failed");
  assert.equal(previousComparableScan(history, 0)?.id, "2");
});

test("critical-only movement does not also report the same delta as issues", () => {
  const changes = scanChanges(
    scan("2", "degraded", { crit: 2, warn: 1, updates: 1 }),
    scan("1", "degraded", { crit: 1, warn: 1, updates: 1 }),
  );
  assert.deepEqual(
    changes.map((change) => change.text),
    ["↑ 1 critical finding"],
  );
});

test("issue and update movement use arrows or resolved copy, with spoken text", () => {
  const worse = scanChanges(
    scan("2", "degraded", { crit: 0, warn: 4, updates: 2 }),
    scan("1", "degraded", { crit: 0, warn: 1, updates: 1 }),
  );
  assert.deepEqual(
    worse.map((change) => change.text),
    ["↑ 3 issues", "↑ 1 update"],
  );
  assert.equal(worse[0]?.spoken, "3 more issues than the previous comparable scan");

  const better = scanChanges(
    scan("2", "ok", { crit: 0, warn: 0, updates: 0 }),
    scan("1", "degraded", { crit: 0, warn: 2, updates: 2 }),
  );
  assert.deepEqual(
    better.map((change) => change.text),
    ["↓ 2 issues", "2 updates resolved"],
  );
  assert.match(better[1]?.spoken ?? "", /resolved/);
});

test("failed and incomplete scans never produce a comparison", () => {
  assert.deepEqual(scanChanges(scan("2", "down", { crit: 1 }), scan("1", "ok")), []);
  assert.deepEqual(scanChanges(scan("2", "ok"), scan("1", "auth_failed", { crit: 1 })), []);
});

test("timeline uses stored history, and falls back to the latest snapshot before history loads", () => {
  const latest: ScanSnapshot = {
    id: "c9",
    siteId: "s1",
    startedAt: "t0",
    finishedAt: "2026-08-15T13:21:00.000Z",
    rollup: "degraded",
    coreVersion: "6.7.1",
    plugins: [],
    findings: [
      { kind: "exposed_path", severity: "crit", title: "debug.log", detail: "", path: "/debug.log" },
      { kind: "plugin_update", severity: "warn", title: "Akismet", detail: "" },
    ],
    helper: null,
  };
  assert.deepEqual(scansForTimeline({ latest, history: [] }), [
    {
      id: "c9",
      finishedAt: "2026-08-15T13:21:00.000Z",
      rollup: "degraded",
      counts: { crit: 1, warn: 1, info: 0, updates: 1 },
    },
  ]);
  const stored = [scan("8", "ok"), scan("7", "ok")];
  assert.equal(scansForTimeline({ latest, history: stored })[0]?.id, "8");
  assert.deepEqual(scansForTimeline({ latest: null, history: [] }), []);
});

test("history stays newest first and keeps failed rows in place", () => {
  const entries = scanHistoryEntries([
    scan("3", "ok"),
    scan("2", "down", { crit: 1 }),
    scan("1", "degraded", { crit: 0, warn: 2, updates: 2 }),
  ]);
  assert.deepEqual(
    entries.map((entry) => [entry.scan.id, entry.outcome]),
    [
      ["3", "completed"],
      ["2", "failed"],
      ["1", "completed"],
    ],
  );
  assert.equal(entries[0]?.changes[0]?.text, "↓ 2 issues");
});
