import { isUpdateFinding, primaryFindingOf, updateCount } from "./primary-finding";
import { effectiveStatus, staleHours, staleLabel } from "./site-status";
import type { SiteStatus } from "./status";
import type { Finding, OverviewRow } from "./types";

export type SiteOverview = {
  status: SiteStatus;
  primaryLabel: string;
  emphasizePrimary: boolean;
  extra: string | null;
  finishedAt: string | null;
  running: boolean;
  staleLabel: string | null;
};

export function siteOverview(row: OverviewRow): SiteOverview {
  const status = effectiveStatus(row);
  const findings = row.latest?.findings ?? [];
  const primary = primaryFindingOf(findings);
  const hours = staleHours(row);
  const stale = hours !== null ? staleLabel(hours) : null;
  return {
    status,
    primaryLabel: primaryLabelOf({ status, primary, running: Boolean(row.running), stale }),
    emphasizePrimary: status !== "healthy",
    extra: extraLabelOf(findings, primary, stale, primary !== null),
    finishedAt: row.latest?.finishedAt ?? null,
    running: Boolean(row.running),
    staleLabel: stale,
  };
}

function primaryLabelOf({
  status,
  primary,
  running,
  stale,
}: {
  status: SiteStatus;
  primary: Finding | null;
  running: boolean;
  stale: string | null;
}): string {
  if (status === "unknown") {
    return running ? "Scan in progress" : "Not scanned yet";
  }
  if (!primary) {
    return stale ?? "No action required";
  }
  return primary.title;
}

function extraLabelOf(
  findings: readonly Finding[],
  primary: Finding | null,
  stale: string | null,
  hasPrimary: boolean,
): string | null {
  const updates = updateCount(findings);
  const staleExtra = hasPrimary ? stale : null;
  if (updates === 0) {
    return staleExtra;
  }
  const primaryIsOnlyUpdate = primary !== null && isPrimaryTheSoleUpdate(primary, updates);
  const updatesExtra = primaryIsOnlyUpdate ? null : `${updates} update${updates === 1 ? "" : "s"}`;
  return [staleExtra, updatesExtra].filter(Boolean).join(" · ") || null;
}

function isPrimaryTheSoleUpdate(primary: Finding, updates: number): boolean {
  return updates === 1 && isUpdateFinding(primary);
}

export function siteRowCopy(
  overview: SiteOverview,
  formatAgo: (iso: string) => string,
  formatWhen: (iso: string) => string = formatAgo,
): { finding: string | null; meta: string } {
  const resultStamp = overview.finishedAt
    ? overview.running
      ? `Showing results from ${formatWhen(overview.finishedAt)}`
      : `Last scanned ${formatAgo(overview.finishedAt)}`
    : null;
  if (overview.emphasizePrimary) {
    return {
      finding: overview.primaryLabel,
      meta: [overview.extra, resultStamp].filter(Boolean).join(" · "),
    };
  }
  return {
    finding: null,
    meta: [overview.extra, resultStamp].filter(Boolean).join(" · "),
  };
}
