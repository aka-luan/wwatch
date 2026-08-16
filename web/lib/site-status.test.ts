import assert from "node:assert/strict";
import { test } from "node:test";
import { STALE_AFTER_HOURS, effectiveStatus, staleHours, staleLabel } from "./site-status.ts";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

test("staleHours is null when there is no scan yet", () => {
  assert.equal(staleHours({ latest: null, running: null }), null);
});

test("staleHours is null while a scan is running, even if the last result is old", () => {
  assert.equal(
    staleHours({ latest: { finishedAt: isoHoursAgo(100) }, running: { id: "j1", startedAt: isoHoursAgo(1) } }),
    null,
  );
});

test("staleHours is null under the threshold and set above it", () => {
  assert.equal(staleHours({ latest: { finishedAt: isoHoursAgo(10) }, running: null }), null);
  const hours = staleHours({ latest: { finishedAt: isoHoursAgo(72) }, running: null });
  assert.ok(hours !== null && hours > STALE_AFTER_HOURS);
});

test("staleLabel reads in whole days, falling back under a day", () => {
  assert.equal(staleLabel(49), "Not scanned in 2 days");
  assert.equal(staleLabel(72), "Not scanned in 3 days");
  assert.equal(staleLabel(24), "Not scanned in 1 day");
  assert.equal(staleLabel(10), "Not scanned in over 48 hours");
});

test("effectiveStatus bumps a healthy-but-stale site to attention", () => {
  const status = effectiveStatus({
    latest: { findings: [], finishedAt: isoHoursAgo(72) },
    running: null,
  });
  assert.equal(status, "attention");
});

test("effectiveStatus never downgrades critical or attention findings", () => {
  const critical = effectiveStatus({
    latest: { findings: [{ severity: "crit" }], finishedAt: isoHoursAgo(72) },
    running: null,
  });
  assert.equal(critical, "critical");
});

test("effectiveStatus ignores staleness for a healthy, recently scanned site", () => {
  const status = effectiveStatus({
    latest: { findings: [], finishedAt: isoHoursAgo(2) },
    running: null,
  });
  assert.equal(status, "healthy");
});
