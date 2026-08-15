import { isUpdateFinding, primaryFindingOf, updateCount } from "./primary-finding";
import { siteStatusOf, type SiteStatus } from "./status";
import type { Finding, OverviewRow } from "./types";

export type SiteOverview = {
  status: SiteStatus;
  primaryLabel: string;
  emphasizePrimary: boolean;
  extra: string | null;
  finishedAt: string | null;
  running: boolean;
};

export function siteOverview(row: OverviewRow): SiteOverview {
  const status = siteStatusOf(row);
  const findings = row.latest?.findings ?? [];
  const primary = primaryFindingOf(findings);
  return {
    status,
    primaryLabel: primaryLabelOf({ status, primary, running: Boolean(row.running) }),
    emphasizePrimary: status !== "healthy",
    extra: extraLabelOf(findings, primary),
    finishedAt: row.latest?.finishedAt ?? null,
    running: Boolean(row.running),
  };
}

function primaryLabelOf({
  status,
  primary,
  running,
}: {
  status: SiteStatus;
  primary: Finding | null;
  running: boolean;
}): string {
  if (status === "unknown") {
    return running ? "Scan in progress" : "Not scanned yet";
  }
  if (!primary) {
    return "No action required";
  }
  return primary.title;
}

function extraLabelOf(findings: readonly Finding[], primary: Finding | null): string | null {
  const updates = updateCount(findings);
  if (updates === 0) {
    return null;
  }
  const primaryIsOnlyUpdate = primary !== null && isPrimaryTheSoleUpdate(primary, updates);
  if (primaryIsOnlyUpdate) {
    return null;
  }
  return `${updates} update${updates === 1 ? "" : "s"}`;
}

function isPrimaryTheSoleUpdate(primary: Finding, updates: number): boolean {
  return updates === 1 && isUpdateFinding(primary);
}

export function siteRowCopy(
  overview: SiteOverview,
  formatAgo: (iso: string) => string,
): { finding: string | null; meta: string } {
  const scanned = overview.finishedAt ? `scanned ${formatAgo(overview.finishedAt)}` : null;
  const scanning = overview.running && overview.finishedAt ? "scanning" : null;
  if (overview.emphasizePrimary) {
    return {
      finding: overview.primaryLabel,
      meta: [overview.extra, scanning, scanned].filter(Boolean).join(" · "),
    };
  }
  return {
    finding: null,
    meta: [overview.primaryLabel, overview.extra, scanning, scanned].filter(Boolean).join(" · "),
  };
}
