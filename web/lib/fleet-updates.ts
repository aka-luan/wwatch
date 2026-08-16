import { findingDisplayCopy } from "./finding-groups";
import { helperCan } from "./helper";
import { isUpdateFinding } from "./primary-finding";
import type { Finding, OverviewRow } from "./types";

export type UpdateKind = "plugin" | "theme" | "core";

export type FleetUpdateItem = {
  key: string;
  siteId: string;
  siteName: string;
  kind: UpdateKind;
  title: string;
  detail?: string;
  installed?: string;
  latest?: string;
  plugin?: string;
  theme?: string;
};

export type FleetUpdateSiteGroup = {
  siteId: string;
  siteName: string;
  canUpdate: boolean;
  running: boolean;
  helperMissing: boolean;
  items: FleetUpdateItem[];
  pluginThemeCount: number;
  hasCore: boolean;
};

export type FleetUpdateSummary = {
  updateCount: number;
  siteCount: number;
  groups: FleetUpdateSiteGroup[];
};

export function updateKindOf(finding: Finding): UpdateKind | null {
  if (finding.kind === "plugin_update") {
    return "plugin";
  }
  if (finding.kind === "theme_update") {
    return "theme";
  }
  if (finding.kind === "core_update") {
    return "core";
  }
  return null;
}

export function fleetUpdateItemKey(siteId: string, finding: Finding): string | null {
  const kind = updateKindOf(finding);
  if (!kind) {
    return null;
  }
  if (kind === "plugin") {
    return `${siteId}:plugin:${finding.plugin ?? finding.title}`;
  }
  if (kind === "theme") {
    return `${siteId}:theme:${finding.theme ?? finding.title}`;
  }
  return `${siteId}:core`;
}

export function fleetUpdateItemFromFinding(siteId: string, siteName: string, finding: Finding): FleetUpdateItem | null {
  const kind = updateKindOf(finding);
  const key = fleetUpdateItemKey(siteId, finding);
  if (!kind || !key) {
    return null;
  }
  const copy = findingDisplayCopy(finding);
  const versions = versionPair(finding, copy.detail);
  return {
    key,
    siteId,
    siteName,
    kind,
    title: kind === "core" ? "WordPress" : copy.title,
    detail: copy.detail,
    installed: versions?.installed,
    latest: versions?.latest,
    plugin: finding.plugin,
    theme: finding.theme,
  };
}

/** Prefer structured finding fields, then a `installed → latest` detail string. */
export function versionPair(
  finding: Pick<Finding, "installed" | "latest">,
  detail?: string,
): { installed: string; latest: string } | null {
  if (finding.installed && finding.latest) {
    return { installed: finding.installed, latest: finding.latest };
  }
  if (!detail) {
    return null;
  }
  const match = /^(\S+)\s+→\s+(\S+)$/.exec(detail.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { installed: match[1], latest: match[2] };
}

export function fleetUpdateSummary(sites: readonly OverviewRow[]): FleetUpdateSummary {
  const groups: FleetUpdateSiteGroup[] = [];
  let updateCount = 0;

  for (const row of sites) {
    const findings = (row.latest?.findings ?? []).filter(isUpdateFinding);
    if (!findings.length) {
      continue;
    }
    const items = findings
      .map((finding) => fleetUpdateItemFromFinding(row.site.id, row.site.name, finding))
      .filter((item): item is FleetUpdateItem => item !== null)
      .sort(compareUpdateItems);
    if (!items.length) {
      continue;
    }
    const helper = row.latest?.helper ?? null;
    const pluginThemeCount = items.filter((item) => item.kind === "plugin" || item.kind === "theme").length;
    groups.push({
      siteId: row.site.id,
      siteName: row.site.name,
      canUpdate: helperCan(helper, "update"),
      running: Boolean(row.running),
      helperMissing: !helper || helper.kind === "missing",
      items,
      pluginThemeCount,
      hasCore: items.some((item) => item.kind === "core"),
    });
    updateCount += items.length;
  }

  groups.sort((a, b) => a.siteName.localeCompare(b.siteName) || a.siteId.localeCompare(b.siteId));

  return {
    updateCount,
    siteCount: groups.length,
    groups,
  };
}

export function updateRequestBody(item: FleetUpdateItem):
  | { kind: "plugin"; plugin: string }
  | { kind: "theme"; theme: string }
  | { kind: "core" }
  | null {
  if (item.kind === "plugin") {
    if (!item.plugin) {
      return null;
    }
    return { kind: "plugin", plugin: item.plugin };
  }
  if (item.kind === "theme") {
    if (!item.theme) {
      return null;
    }
    return { kind: "theme", theme: item.theme };
  }
  return { kind: "core" };
}

function compareUpdateItems(a: FleetUpdateItem, b: FleetUpdateItem): number {
  const rank = (kind: UpdateKind) => (kind === "core" ? 0 : kind === "plugin" ? 1 : 2);
  const byKind = rank(a.kind) - rank(b.kind);
  if (byKind !== 0) {
    return byKind;
  }
  return a.title.localeCompare(b.title) || a.key.localeCompare(b.key);
}
