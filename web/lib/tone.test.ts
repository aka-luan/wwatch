import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_STATUSES } from "./status.ts";
import {
  TONES,
  TONE_ACCENT,
  TONE_DOT,
  TONE_FROM_SEVERITY,
  TONE_FROM_STATUS,
  TONE_RAIL,
  TONE_RAIL_STRONG,
  TONE_SURFACE,
  TONE_TEXT,
  toneOf,
} from "./tone.ts";

test("every site status maps to a tone", () => {
  for (const status of SITE_STATUSES) {
    assert.ok(TONES.includes(toneOf(status)));
  }
  assert.equal(TONE_FROM_STATUS.attention, "warning");
  assert.equal(TONE_FROM_STATUS.unknown, "neutral");
});

test("severity maps to a tone without inventing a site status", () => {
  assert.equal(TONE_FROM_SEVERITY.crit, "critical");
  assert.equal(TONE_FROM_SEVERITY.warn, "warning");
  assert.equal(TONE_FROM_SEVERITY.info, "info");
});

test("every tone has a class in every map", () => {
  for (const tone of TONES) {
    for (const map of [TONE_DOT, TONE_TEXT, TONE_ACCENT, TONE_RAIL, TONE_RAIL_STRONG, TONE_SURFACE]) {
      assert.ok(map[tone], `${tone} is missing a class`);
    }
  }
});

test("a healthy row rail stays neutral so color only marks a problem", () => {
  assert.equal(TONE_RAIL.healthy, "border-border");
  assert.equal(TONE_RAIL.neutral, "border-border");
  assert.match(TONE_RAIL.critical, /destructive/);
  assert.match(TONE_RAIL.warning, /warning/);
});

test("tinted surfaces stay a wash rather than a block of color", () => {
  for (const tone of TONES) {
    if (tone === "neutral") {
      continue;
    }
    assert.match(TONE_SURFACE[tone], /\/10\b/, `${tone} fill should be /10`);
    assert.match(TONE_SURFACE[tone], /\/25\b/, `${tone} border should be /25`);
  }
});
