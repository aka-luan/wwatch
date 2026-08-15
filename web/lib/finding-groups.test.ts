import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findingDisplayCopy,
  groupIdForFinding,
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

test("exposed path copy hides the scanner 200 detail", () => {
  assert.deepEqual(
    findingDisplayCopy(
      finding("exposed_path", "crit", "debug.log is public", {
        path: "/debug.log",
        detail: "https://example.com/debug.log returned 200",
      }),
    ),
    { title: "debug.log is public", detail: "Potential information exposure." },
  );
});

test("sections keep semantic order and put actionable rows ahead of healthy checks", () => {
  const sections = siteFindingSections({
    origin: "https://example.com",
    scanned: true,
    findings: [
      finding("xmlrpc_open", "info", "xmlrpc.php accepts requests"),
      finding("plugin_update", "warn", "Akismet 1.0 → 1.1", { plugin: "akismet/akismet.php" }),
      finding("broken_link", "warn", "Broken link (404)", { url: "https://example.com/missing" }),
      finding("broken_link", "warn", "Broken link (404)", { url: "https://example.com/gone" }),
      finding("exposed_path", "crit", "debug.log is public", { path: "/debug.log" }),
      finding("site_health", "warn", "PHP is out of date"),
    ],
  });
  assert.deepEqual(
    sections.map((section) => section.id),
    ["security", "updates", "reliability", "wordpress"],
  );
  assert.deepEqual(
    sections[0]?.items.map((item) => item.title),
    ["debug.log is public", "xmlrpc.php accepts requests"],
  );
  assert.equal(sections[1]?.items[0]?.title, "Akismet");
  assert.equal(sections[1]?.items[0]?.showStatus, false);
  assert.deepEqual(
    sections[2]?.items.map((item) => ({ title: item.title, compact: item.compact })),
    [
      { title: "2 broken links", compact: false },
      { title: "Site reachable", compact: true },
      { title: "TLS valid", compact: true },
    ],
  );
  assert.equal(sections[3]?.items[0]?.title, "PHP is out of date");
});

test("healthy reliability checks stay compact and omit TLS on http", () => {
  const sections = siteFindingSections({
    origin: "http://127.0.0.1:8080",
    scanned: true,
    findings: [finding("xmlrpc_open", "info", "xmlrpc.php accepts requests")],
  });
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
    [["reliability", ["Site did not respond"]]],
  );
});

test("does not invent healthy checks before the first scan", () => {
  assert.deepEqual(siteFindingSections({ origin: "https://example.com", scanned: false, findings: [] }), []);
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
  const wordpress = sections.find((section) => section.id === "wordpress");
  assert.deepEqual(
    wordpress?.items.map((item) => item.title),
    ["You should use a persistent object cache"],
  );
});
