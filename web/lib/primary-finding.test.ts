import assert from "node:assert/strict";
import { test } from "node:test";
import { primaryFindingOf, updateCount } from "./primary-finding.ts";
import type { Finding } from "./types.ts";

function finding(kind: string, severity: Finding["severity"], title: string): Finding {
  return { kind, severity, title, detail: "" };
}

test("primary finding ignores info-only noise", () => {
  assert.equal(
    primaryFindingOf([
      finding("xmlrpc_open", "info", "xmlrpc.php accepts requests"),
      finding("readme", "info", "readme.html is public"),
    ]),
    null,
  );
});

test("primary finding prefers crit security exposure over updates and warnings", () => {
  const exposed = finding("exposed_path", "crit", "debug.log is public");
  const picked = primaryFindingOf([
    finding("plugin_update", "warn", "Akismet 1.0 → 1.1"),
    exposed,
    finding("broken_link", "warn", "Broken link (404)"),
  ]);
  assert.equal(picked, exposed);
});

test("primary finding prefers reachability failure over other crits", () => {
  const down = finding("down", "crit", "Site did not respond");
  const picked = primaryFindingOf([
    finding("exposed_path", "crit", "debug.log is public"),
    down,
    finding("core_update", "crit", "WordPress 6.4 → 6.7"),
  ]);
  assert.equal(picked, down);
});

test("primary finding prefers auth failure over updates when both are present", () => {
  const auth = finding("auth_failed", "crit", "Application Password was rejected");
  assert.equal(primaryFindingOf([finding("plugin_update", "warn", "Akismet 1.0 → 1.1"), auth]), auth);
});

test("primary finding among warnings prefers TLS, then core updates, then plugins, then broken links", () => {
  const tls = finding("tls_expiring", "warn", "TLS certificate expires in 18 days");
  const core = finding("core_update", "warn", "WordPress 6.7.1 → 6.7.2");
  const plugin = finding("plugin_update", "warn", "Akismet 1.0 → 1.1");
  const link = finding("broken_link", "warn", "Broken link (404)");
  assert.equal(primaryFindingOf([link, plugin, core, tls]), tls);
  assert.equal(primaryFindingOf([link, plugin, core]), core);
  assert.equal(primaryFindingOf([link, plugin]), plugin);
  assert.equal(primaryFindingOf([link]), link);
});

test("primary finding keeps scan order when weights tie", () => {
  const first = finding("plugin_update", "warn", "Akismet 1.0 → 1.1");
  const second = finding("plugin_update", "warn", "Hello Dolly 1.0 → 1.1");
  assert.equal(primaryFindingOf([first, second]), first);
});

test("update count covers plugins, themes, and core", () => {
  assert.equal(
    updateCount([
      finding("plugin_update", "warn", "Akismet 1.0 → 1.1"),
      finding("theme_update", "warn", "Twenty Twenty-Four 1.0 → 1.1"),
      finding("core_update", "warn", "WordPress 6.7.1 → 6.7.2"),
      finding("broken_link", "warn", "Broken link"),
    ]),
    3,
  );
});
