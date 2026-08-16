import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finishedScanSites,
  isScanFailure,
  lastSuccessfulFinishedAt,
  scanningLabel,
  scanOperationOf,
  scanStageOf,
} from "./scan-operation.ts";
import type { Finding, OverviewRow, ScanSnapshot, ScanSummary, Site } from "./types.ts";

const site: Site = { id: "s1", name: "Client A", origin: "https://example.com" };

function snapshot(overrides: Partial<ScanSnapshot> & { findings?: Finding[] } = {}): ScanSnapshot {
  return {
    id: "c1",
    siteId: "s1",
    startedAt: "2026-08-15T10:00:00.000Z",
    finishedAt: "2026-08-15T10:42:00.000Z",
    rollup: "ok",
    coreVersion: "6.7.1",
    plugins: [],
    findings: [],
    helper: null,
    ...overrides,
  };
}

function row(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    site,
    latest: snapshot(),
    running: null,
    rollup: "ok",
    ...overrides,
  };
}

test("isScanFailure detects down rollups and down findings", () => {
  assert.equal(isScanFailure(null), false);
  assert.equal(isScanFailure(snapshot()), false);
  assert.equal(isScanFailure(snapshot({ rollup: "down" })), true);
  assert.equal(
    isScanFailure(
      snapshot({
        rollup: "ok",
        findings: [{ kind: "down", severity: "crit", title: "Scan failed", detail: "boom" }],
      }),
    ),
    true,
  );
});

test("lastSuccessfulFinishedAt prefers the latest non-down history entry after a failure", () => {
  const failed = snapshot({
    id: "c3",
    rollup: "down",
    finishedAt: "2026-08-15T12:00:00.000Z",
    findings: [{ kind: "down", severity: "crit", title: "Scan failed", detail: "timeout" }],
  });
  const history: ScanSummary[] = [
    { id: "c3", finishedAt: "2026-08-15T12:00:00.000Z", rollup: "down", counts: { crit: 1, warn: 0, info: 0, updates: 0 } },
    { id: "c2", finishedAt: "2026-08-15T10:42:00.000Z", rollup: "degraded", counts: { crit: 0, warn: 1, info: 0, updates: 0 } },
    { id: "c1", finishedAt: "2026-08-14T10:00:00.000Z", rollup: "ok", counts: { crit: 0, warn: 0, info: 0, updates: 0 } },
  ];
  assert.equal(lastSuccessfulFinishedAt({ latest: failed, history }), "2026-08-15T10:42:00.000Z");
  assert.equal(lastSuccessfulFinishedAt({ latest: snapshot(), history }), "2026-08-15T10:42:00.000Z");
  assert.equal(lastSuccessfulFinishedAt({ latest: failed, history: [] }), null);
});

test("scanOperationOf distinguishes running, failed, and idle without inventing stages", () => {
  assert.deepEqual(scanOperationOf(row({ running: { id: "j1", startedAt: "t0" } })), {
    kind: "running",
    stage: null,
    showingFrom: "2026-08-15T10:42:00.000Z",
  });
  assert.deepEqual(
    scanOperationOf({
      ...row({
        latest: snapshot({
          rollup: "down",
          findings: [{ kind: "down", severity: "crit", title: "Scan failed", detail: "boom" }],
        }),
        rollup: "down",
      }),
      history: [
        {
          id: "c0",
          finishedAt: "2026-08-15T09:00:00.000Z",
          rollup: "ok",
          counts: { crit: 0, warn: 0, info: 0, updates: 0 },
        },
      ],
    }),
    {
      kind: "failed",
      lastSuccessfulAt: "2026-08-15T09:00:00.000Z",
      detail: "boom",
    },
  );
  assert.deepEqual(scanOperationOf(row()), { kind: "idle" });
  assert.equal(scanStageOf({ id: "j1", startedAt: "t0" }), null);
});

test("scanningLabel only formats real stage counts", () => {
  assert.equal(scanningLabel(null), "Scanning");
  assert.equal(scanningLabel({ label: "checking plugins" }), "Scanning · checking plugins");
  assert.equal(scanningLabel({ label: "checking plugins", done: 4, total: 7 }), "Checking plugins · 4/7");
});

test("finishedScanSites returns rows that left the running set", () => {
  const doneOk = row({
    site: { id: "s2", name: "Other", origin: "https://other.example" },
    latest: snapshot({ id: "c2", siteId: "s2", rollup: "ok" }),
    running: null,
  });
  const stillRunning = row({ running: { id: "j1", startedAt: "t0" } });
  const previous = new Set(["s1", "s2"]);
  assert.deepEqual(
    finishedScanSites(previous, [
      row({ running: null }),
      doneOk,
    ]).map((item) => item.site.id),
    ["s1", "s2"],
  );
  assert.deepEqual(finishedScanSites(previous, [stillRunning, doneOk]).map((item) => item.site.id), ["s2"]);
});
