import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_STATUSES, SITE_STATUS_LABEL, STATUS_BADGE_VARIANT } from "./status.ts";

test("status badges use semantic variants instead of raw color classes", () => {
  assert.equal(STATUS_BADGE_VARIANT.critical, "destructive");
  assert.equal(STATUS_BADGE_VARIANT.attention, "warning");
  assert.equal(STATUS_BADGE_VARIANT.healthy, "success");
  assert.equal(STATUS_BADGE_VARIANT.unknown, "secondary");
  for (const status of SITE_STATUSES) {
    assert.ok(STATUS_BADGE_VARIANT[status]);
  }
});

test("status badge labels stay readable without relying on color", () => {
  assert.equal(SITE_STATUS_LABEL.critical, "Critical");
  assert.equal(SITE_STATUS_LABEL.attention, "Attention");
  assert.equal(SITE_STATUS_LABEL.healthy, "Healthy");
  assert.equal(SITE_STATUS_LABEL.unknown, "Unknown");
});
