import assert from "node:assert/strict";
import { test } from "node:test";
import { selectionWarning, skipReason, skipSentence, updatePlan } from "./update-plan.ts";
import type { Finding, HelperInfo, OverviewRow } from "./types.ts";

function update(name: string, plugin: string): Finding {
  return {
    kind: "plugin_update",
    severity: "warn",
    title: `${name} 3.20.2 → 4.2.2`,
    detail: "",
    plugin,
    installed: "3.20.2",
    latest: "4.2.2",
  };
}

function row(id: string, name: string, findings: Finding[], helper: HelperInfo | null, running = false): OverviewRow {
  return {
    site: { id, name, origin: `https://${id}.example.com` },
    latest: {
      id: `scan-${id}`,
      siteId: id,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      rollup: "degraded",
      coreVersion: "6.8.1",
      plugins: [],
      findings,
      helper,
    },
    running: running ? { id: "run", startedAt: "2026-01-01T00:02:00.000Z" } : null,
    rollup: "degraded",
  };
}

const ABLE: HelperInfo = { kind: "installed", version: "1.3.0", capabilities: ["update"] };

test("skipReason names why a site can't update", () => {
  assert.equal(skipReason({ siteId: "a", siteName: "A", canUpdate: true, running: false, helperMissing: false, items: [], pluginThemeCount: 0, hasCore: false }), null);
  assert.match(
    skipReason({ siteId: "a", siteName: "A", canUpdate: false, running: false, helperMissing: true, items: [], pluginThemeCount: 0, hasCore: false }) ?? "",
    /helper plugin isn't installed/,
  );
  assert.match(
    skipReason({ siteId: "a", siteName: "A", canUpdate: true, running: true, helperMissing: false, items: [], pluginThemeCount: 0, hasCore: false }) ?? "",
    /scan is already running/,
  );
});

test("updatePlan itemizes runnable groups and names every skipped site", () => {
  const plan = updatePlan([
    row("able", "Skyrocket", [update("Elementor", "elementor/elementor.php")], ABLE),
    row("nohelper", "Loja Verde", [update("Akismet", "akismet/akismet.php")], { kind: "missing" }),
    row("clean", "Padaria Sol", [], ABLE),
  ]);
  assert.deepEqual(plan.groups.map((group) => group.siteName), ["Skyrocket"]);
  assert.equal(plan.itemCount, 1);
  assert.equal(plan.siteCount, 1);
  assert.deepEqual(plan.skipped.map((skip) => skip.siteName), ["Loja Verde"]);
  assert.match(skipSentence(plan.skipped) ?? "", /^Loja Verde is skipped — .*helper plugin isn't installed/);
});

test("updatePlan honours an explicit selection", () => {
  const sites = [
    row("a", "A", [update("Elementor", "elementor/elementor.php")], ABLE),
    row("b", "B", [update("Akismet", "akismet/akismet.php")], ABLE),
  ];
  const plan = updatePlan(sites, new Set(["b"]));
  assert.equal(plan.siteCount, 1);
  assert.equal(plan.itemCount, 1);
  assert.equal(plan.items[0]?.siteId, "b");
  assert.equal(updatePlan(sites, new Set()).itemCount, 0);
  assert.equal(updatePlan(sites).itemCount, 2);
});

test("selectionWarning only fires when something is skipped", () => {
  const clean = updatePlan([row("a", "A", [update("Elementor", "elementor/elementor.php")], ABLE)]);
  assert.equal(selectionWarning(clean), null);
  const blocked = updatePlan([row("a", "A", [update("Elementor", "elementor/elementor.php")], { kind: "missing" })]);
  assert.equal(selectionWarning(blocked), "1 site can't update — see the confirm step");
  assert.equal(skipSentence([]), null);
});
