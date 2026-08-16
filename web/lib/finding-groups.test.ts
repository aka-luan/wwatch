import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findingDisplayCopy,
  groupIdForFinding,
  sectionIdForFinding,
  siteActionabilityGroups,
  siteFindingSections,
} from "./finding-groups.ts";
import type { Finding } from "./types.ts";

function finding(
  kind: string,
  severity: Finding["severity"],
  title: string,
  extra: Partial<Finding> = {},
): Finding {
  return { kind, severity, title, detail: extra.detail ?? "", ...extra };
}

test("groups map scanner kinds onto operational sections", () => {
  assert.equal(groupIdForFinding(finding("exposed_path", "crit", "debug.log is public")), "security");
  assert.equal(groupIdForFinding(finding("plugin_update", "warn", "Akismet 1.0 → 1.1")), "updates");
  assert.equal(groupIdForFinding(finding("down", "crit", "Site did not respond")), "reliability");
  assert.equal(groupIdForFinding(finding("auth_failed", "crit", "Application Password was rejected")), "wordpress");
  assert.equal(groupIdForFinding(finding("future_kind", "warn", "Something new")), "wordpress");
});

test("display sections put actionable findings ahead of updates and info", () => {
  assert.equal(sectionIdForFinding(finding("exposed_path", "crit", "debug.log is public")), "attention");
  assert.equal(sectionIdForFinding(finding("site_health", "warn", "PHP is out of date")), "attention");
  assert.equal(sectionIdForFinding(finding("plugin_update", "warn", "Akismet 1.0 → 1.1")), "updates");
  assert.equal(sectionIdForFinding(finding("xmlrpc_open", "info", "xmlrpc.php accepts requests")), "security");
  assert.equal(sectionIdForFinding(finding("plugin_unknown", "info", "Premium is not on wordpress.org")), "wordpress");
  assert.equal(sectionIdForFinding(finding("readme", "info", "readme.html is public")), "wordpress");
});

test("update copy splits name from version range", () => {
  assert.deepEqual(
    findingDisplayCopy(
      finding("plugin_update", "warn", "Elementor 3.21.0 → 3.22.1", {
        installed: "3.21.0",
        latest: "3.22.1",
      }),
    ),
    { title: "Elementor", detail: "3.21.0 → 3.22.1" },
  );
});

test("exposed path copy hides the scanner 200 detail until expanded", () => {
  assert.deepEqual(
    findingDisplayCopy(
      finding("exposed_path", "crit", "debug.log is public", {
        path: "/debug.log",
        detail: "https://example.com/debug.log returned 200",
      }),
    ),
    {
      title: "debug.log is public",
      explanation: "Potential information exposure.",
      detail: "https://example.com/debug.log returned 200",
    },
  );
});

test("sections keep operational order and put actionable rows ahead of healthy checks", () => {
  const sections = siteFindingSections({
    origin: "https://example.com",
    scanned: true,
    findings: [
      finding("xmlrpc_open", "info", "xmlrpc.php accepts requests"),
      finding("plugin_update", "warn", "Akismet 1.0 → 1.1", { plugin: "akismet/akismet.php" }),
      finding("broken_link", "warn", "Broken link (404)", { url: "https://example.com/missing" }),
      finding("broken_link", "warn", "Broken link (404)", { url: "https://example.com/gone" }),
      finding("exposed_path", "crit", "debug.log is public", { path: "/debug.log" }),
      finding("exposed_path", "info", "readme.html is public", { path: "/readme.html" }),
      finding("site_health", "warn", "PHP is out of date"),
    ],
  });
  assert.deepEqual(
    sections.map((section) => section.id),
    ["attention", "updates", "reliability", "security"],
  );
  assert.deepEqual(
    sections[0]?.items.map((item) => item.title),
    ["debug.log is public", "PHP is out of date", "2 broken links"],
  );
  assert.equal(sections[0]?.items[0]?.tone, "actionable");
  assert.equal(sections[1]?.items[0]?.title, "Akismet");
  assert.equal(sections[1]?.items[0]?.tone, "update");
  assert.deepEqual(
    sections[2]?.items.map((item) => ({ title: item.title, compact: item.compact, tone: item.tone })),
    [
      { title: "Site reachable", compact: true, tone: "positive" },
      { title: "TLS valid", compact: true, tone: "positive" },
    ],
  );
  assert.deepEqual(
    sections[3]?.items.map((item) => ({ title: item.title, tone: item.tone })),
    [
      { title: "readme.html is public", tone: "info" },
      { title: "xmlrpc.php accepts requests", tone: "info" },
    ],
  );
});

test("healthy reliability checks stay compact and omit TLS on http", () => {
  const sections = siteFindingSections({
    origin: "http://127.0.0.1:8080",
    scanned: true,
    findings: [finding("xmlrpc_open", "info", "xmlrpc.php accepts requests")],
  });
  assert.deepEqual(
    sections.map((section) => section.id),
    ["reliability", "security"],
  );
  const reliability = sections.find((section) => section.id === "reliability");
  assert.deepEqual(
    reliability?.items.map((item) => item.title),
    ["Site reachable"],
  );
  assert.equal(reliability?.items[0]?.compact, true);
});

test("down findings skip reachable and TLS healthy checks", () => {
  const sections = siteFindingSections({
    origin: "https://example.com",
    scanned: true,
    findings: [finding("down", "crit", "Site did not respond", { detail: "ECONNREFUSED" })],
  });
  assert.deepEqual(
    sections.map((section) => [section.id, section.items.map((item) => item.title)]),
    [["attention", ["Site did not respond"]]],
  );
});

test("does not invent healthy checks before the first scan", () => {
  assert.deepEqual(siteFindingSections({ origin: "https://example.com", scanned: false, findings: [] }), []);
});

test("actionability groups put every actionable and update finding ahead of info, by severity", () => {
  const groups = siteActionabilityGroups([
    finding("xmlrpc_open", "info", "xmlrpc.php accepts requests"),
    finding("exposed_path", "info", "readme.html is public", { path: "/readme.html" }),
    finding("plugin_unknown", "info", "Premium is not on wordpress.org"),
    finding("plugin_update", "warn", "Akismet 1.0 → 1.1", { plugin: "akismet/akismet.php" }),
    finding("exposed_path", "crit", "debug.log is public", { path: "/debug.log" }),
    finding("broken_link", "warn", "Broken link (404)", { url: "https://example.com/missing" }),
  ]);
  assert.deepEqual(
    groups.needsAction.map((item) => item.title),
    ["debug.log is public", "Akismet", "Broken link (404)"],
  );
  assert.ok(groups.needsAction.every((item) => item.tone !== "info"));
  assert.deepEqual(
    groups.informational.map((item) => item.title).sort(),
    ["Premium is not on wordpress.org", "readme.html is public", "xmlrpc.php accepts requests"].sort(),
  );
  assert.ok(groups.informational.every((item) => item.tone === "info"));
});

test("actionability groups are empty for a clean scan", () => {
  assert.deepEqual(siteActionabilityGroups([]), { needsAction: [], informational: [] });
});

test("collapses repeated site health copy into one row", () => {
  const sections = siteFindingSections({
    origin: "https://example.com",
    scanned: true,
    findings: [
      finding("site_health", "warn", "You should use a persistent object cache"),
      finding("site_health", "warn", "You should use a persistent object cache"),
      finding("site_health", "warn", "You should use a persistent object cache"),
    ],
  });
  const attention = sections.find((section) => section.id === "attention");
  assert.deepEqual(
    attention?.items.map((item) => item.title),
    ["You should use a persistent object cache"],
  );
});
