import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fleetUpdateItemFromFinding,
  fleetUpdateItemKey,
  fleetUpdateSummary,
  updateKindOf,
  updateRequestBody,
  versionPair,
} from "./fleet-updates.ts";
import type { Finding, OverviewRow } from "./types.ts";

function finding(
  kind: string,
  title: string,
  extra: Partial<Finding> = {},
): Finding {
  return { kind, severity: "warn", title, detail: extra.detail ?? "", ...extra };
}

function row(
  id: string,
  name: string,
  findings: Finding[],
  helper: OverviewRow["latest"] extends infer L
    ? L extends { helper: infer H }
      ? H
      : never
    : never = { kind: "installed", version: "1", capabilities: ["update"] },
  running: OverviewRow["running"] = null,
): OverviewRow {
  return {
    site: { id, name, origin: `https://${id}.example` },
    latest: {
      id: `scan-${id}`,
      siteId: id,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      rollup: "degraded",
      coreVersion: "6.7",
      plugins: [],
      findings,
      helper,
    },
    running,
    rollup: "degraded",
  };
}

test("updateKindOf maps finding kinds", () => {
  assert.equal(updateKindOf(finding("plugin_update", "Akismet")), "plugin");
  assert.equal(updateKindOf(finding("theme_update", "Twenty Twenty-Five")), "theme");
  assert.equal(updateKindOf(finding("core_update", "WordPress")), "core");
  assert.equal(updateKindOf(finding("exposed_path", "debug.log")), null);
});

test("fleetUpdateSummary groups updates by site and counts totals", () => {
  const summary = fleetUpdateSummary([
    row("b", "Client B", [
      finding("plugin_update", "WooCommerce 9.0 → 9.1", {
        plugin: "woocommerce/woocommerce.php",
        installed: "9.0",
        latest: "9.1",
      }),
    ]),
    row("a", "Client A", [
      finding("core_update", "WordPress 6.6 → 6.7", { installed: "6.6", latest: "6.7" }),
      finding("plugin_update", "Elementor 3.21 → 3.22", {
        plugin: "elementor/elementor.php",
        installed: "3.21",
        latest: "3.22",
      }),
      finding("plugin_update", "Yoast SEO 22.4 → 22.5", {
        plugin: "wordpress-seo/wp-seo.php",
        installed: "22.4",
        latest: "22.5",
      }),
    ]),
    row("c", "Healthy", []),
  ]);

  assert.equal(summary.updateCount, 4);
  assert.equal(summary.siteCount, 2);
  assert.deepEqual(
    summary.groups.map((group) => group.siteName),
    ["Client A", "Client B"],
  );
  assert.deepEqual(
    summary.groups[0]?.items.map((item) => item.title),
    ["WordPress", "Elementor", "Yoast SEO"],
  );
  assert.equal(summary.groups[0]?.pluginThemeCount, 2);
  assert.equal(summary.groups[0]?.hasCore, true);
  assert.equal(summary.groups[0]?.canUpdate, true);
  assert.equal(summary.groups[1]?.items[0]?.detail, "9.0 → 9.1");
  assert.equal(summary.groups[1]?.items[0]?.installed, "9.0");
  assert.equal(summary.groups[1]?.items[0]?.latest, "9.1");
});

test("versionPair prefers structured fields then detail text", () => {
  assert.deepEqual(versionPair({ installed: "1", latest: "2" }), { installed: "1", latest: "2" });
  assert.deepEqual(versionPair({}, "3.20.2 → 4.2.2"), { installed: "3.20.2", latest: "4.2.2" });
  assert.equal(versionPair({}, "no versions"), null);
});

test("fleetUpdateSummary marks sites without update capability", () => {
  const summary = fleetUpdateSummary([
    row(
      "a",
      "Needs helper",
      [finding("plugin_update", "Akismet 1 → 2", { plugin: "akismet/akismet.php", installed: "1", latest: "2" })],
      { kind: "missing" },
      { id: "job-1", startedAt: "2026-01-01T00:02:00.000Z" },
    ),
  ]);
  assert.equal(summary.groups[0]?.canUpdate, false);
  assert.equal(summary.groups[0]?.helperMissing, true);
  assert.equal(summary.groups[0]?.running, true);
});

test("fleetUpdateItemFromFinding and updateRequestBody cover targets", () => {
  const plugin = fleetUpdateItemFromFinding(
    "a",
    "A",
    finding("plugin_update", "Akismet 1 → 2", { plugin: "akismet/akismet.php", installed: "1", latest: "2" }),
  );
  assert.equal(plugin?.key, "a:plugin:akismet/akismet.php");
  assert.deepEqual(updateRequestBody(plugin!), { kind: "plugin", plugin: "akismet/akismet.php" });

  const theme = fleetUpdateItemFromFinding(
    "a",
    "A",
    finding("theme_update", "Theme 1 → 2", { theme: "twentytwentyfive", installed: "1", latest: "2" }),
  );
  assert.deepEqual(updateRequestBody(theme!), { kind: "theme", theme: "twentytwentyfive" });

  const core = fleetUpdateItemFromFinding(
    "a",
    "A",
    finding("core_update", "WordPress 6 → 7", { installed: "6", latest: "7" }),
  );
  assert.equal(fleetUpdateItemKey("a", finding("core_update", "WordPress")), "a:core");
  assert.deepEqual(updateRequestBody(core!), { kind: "core" });
});
