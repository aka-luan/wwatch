import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SITE_STATUSES,
  SITE_STATUS_LABEL,
  rollupLabel,
  siteStatusFromRollup,
  siteStatusFromSeverity,
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
