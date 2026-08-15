import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SITE_STATUSES,
  SITE_STATUS_LABEL,
  rollupLabel,
  siteStatusFromCounts,
  siteStatusFromFindings,
  siteStatusFromRollup,
  siteStatusFromSeverity,
  siteStatusOf,
} from "./status.ts";

test("site statuses cover the four product states", () => {
  assert.deepEqual([...SITE_STATUSES], ["critical", "attention", "healthy", "unknown"]);
  for (const status of SITE_STATUSES) {
    assert.ok(SITE_STATUS_LABEL[status]);
  }
});

test("rollup maps onto semantic site statuses", () => {
  assert.equal(siteStatusFromRollup("ok"), "healthy");
  assert.equal(siteStatusFromRollup("degraded"), "attention");
  assert.equal(siteStatusFromRollup("warn"), "attention");
  assert.equal(siteStatusFromRollup("down"), "critical");
  assert.equal(siteStatusFromRollup("auth_failed"), "critical");
  assert.equal(siteStatusFromRollup("crit"), "critical");
  assert.equal(siteStatusFromRollup("never"), "unknown");
  assert.equal(siteStatusFromRollup("running"), "unknown");
  assert.equal(siteStatusFromRollup("info"), "unknown");
});

test("finding severity maps onto semantic site statuses", () => {
  assert.equal(siteStatusFromSeverity("crit"), "critical");
  assert.equal(siteStatusFromSeverity("warn"), "attention");
  assert.equal(siteStatusFromSeverity("info"), "unknown");
});

test("rollup labels stay readable without relying on color", () => {
  assert.equal(rollupLabel("auth_failed"), "auth failed");
  assert.equal(rollupLabel("ok"), "ok");
});

test("findings derive critical vs attention instead of collapsing both into degraded", () => {
  assert.equal(siteStatusFromFindings([]), "healthy");
  assert.equal(siteStatusFromFindings([{ severity: "info" }]), "healthy");
  assert.equal(siteStatusFromFindings([{ severity: "warn" }]), "attention");
  assert.equal(siteStatusFromFindings([{ severity: "warn" }, { severity: "crit" }]), "critical");
});

test("scan history counts use the same status model", () => {
  assert.equal(siteStatusFromCounts({ crit: 0, warn: 0 }), "healthy");
  assert.equal(siteStatusFromCounts({ crit: 0, warn: 2 }), "attention");
  assert.equal(siteStatusFromCounts({ crit: 1, warn: 4 }), "critical");
});

test("site status comes from the latest completed scan, not a running job", () => {
  assert.equal(siteStatusOf({ latest: null }), "unknown");
  assert.equal(siteStatusOf({ latest: { findings: [] } }), "healthy");
  assert.equal(siteStatusOf({ latest: { findings: [{ severity: "crit" }] } }), "critical");
});
