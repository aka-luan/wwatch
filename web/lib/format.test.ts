import assert from "node:assert/strict";
import { test } from "node:test";
import { timelineWhen } from "./format.ts";

test("timelineWhen labels today, yesterday, and older local dates", () => {
  const now = new Date(2026, 7, 15, 18, 0, 0);
  const today = new Date(2026, 7, 15, 13, 21, 0);
  const yesterday = new Date(2026, 7, 14, 19, 4, 0);
  const earlier = new Date(2026, 7, 13, 8, 32, 0);
  const lastYear = new Date(2025, 7, 13, 8, 32, 0);

  assert.match(timelineWhen(today.toISOString(), now), /^Today · \d{2}:\d{2}$/);
  assert.match(timelineWhen(yesterday.toISOString(), now), /^Yesterday · \d{2}:\d{2}$/);
  assert.match(timelineWhen(earlier.toISOString(), now), /13 · \d{2}:\d{2}$/);
  assert.doesNotMatch(timelineWhen(earlier.toISOString(), now), /Today|Yesterday/);
  assert.match(timelineWhen(lastYear.toISOString(), now), /2025/);
});

test("timelineWhen stays readable when the timestamp is unusable", () => {
  assert.equal(timelineWhen("not-a-date"), "Unknown time");
});
