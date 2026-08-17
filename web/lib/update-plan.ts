import { fleetUpdateSummary, type FleetUpdateItem, type FleetUpdateSiteGroup } from "./fleet-updates";
import type { OverviewRow } from "./types";

export type UpdateSkip = {
  siteId: string;
  siteName: string;
  reason: string;
};

export type UpdatePlan = {
  /** Sites whose pending updates can actually run now. */
  groups: FleetUpdateSiteGroup[];
  /** Sites with pending updates that will not run, each with the reason shown to the user. */
  skipped: UpdateSkip[];
  items: FleetUpdateItem[];
  itemCount: number;
  siteCount: number;
};

export function skipReason(group: FleetUpdateSiteGroup): string | null {
  if (group.running) {
    return "a scan is already running";
  }
  if (group.helperMissing) {
    return "the wwatch helper plugin isn't installed, so updates can't run from the board";
  }
  if (!group.canUpdate) {
    return "the installed helper can't apply updates";
  }
  return null;
}

/**
 * Turns a selection into an itemized plan: what runs, and which sites are left out and why.
 * `selectedIds` of `null` means the whole fleet.
 */
export function updatePlan(
  sites: readonly OverviewRow[],
  selectedIds: ReadonlySet<string> | null = null,
): UpdatePlan {
  const summary = fleetUpdateSummary(sites);
  const scoped = selectedIds ? summary.groups.filter((group) => selectedIds.has(group.siteId)) : summary.groups;

  const groups: FleetUpdateSiteGroup[] = [];
  const skipped: UpdateSkip[] = [];
  for (const group of scoped) {
    const reason = skipReason(group);
    if (reason) {
      skipped.push({ siteId: group.siteId, siteName: group.siteName, reason });
      continue;
    }
    groups.push(group);
  }

  const items = groups.flatMap((group) => group.items);
  return { groups, skipped, items, itemCount: items.length, siteCount: groups.length };
}

export function skipSentence(skipped: readonly UpdateSkip[]): string | null {
  if (!skipped.length) {
    return null;
  }
  const [first] = skipped;
  if (!first) {
    return null;
  }
  if (skipped.length === 1) {
    return `${first.siteName} is skipped — ${first.reason}.`;
  }
  const names = skipped.map((skip) => skip.siteName).join(", ");
  return `${skipped.length} sites are skipped — ${names}.`;
}

/** Short warning for the sticky selection bar. */
export function selectionWarning(plan: UpdatePlan): string | null {
  if (!plan.skipped.length) {
    return null;
  }
  const count = plan.skipped.length;
  return `${count} site${count === 1 ? "" : "s"} can't update — see the confirm step`;
}
