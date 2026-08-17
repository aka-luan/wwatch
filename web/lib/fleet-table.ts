import { host } from "./format";
import { helperCan } from "./helper";
import { compareBoardSites, type BoardSite } from "./site-board";
import { siteOverview } from "./site-overview";
import { effectiveStatus, staleHours } from "./site-status";
import { isActionableFinding, isUpdateFinding, primaryFindingOf, updateCount } from "./primary-finding";
import { SITE_STATUS_LABEL, type SiteStatus } from "./status";
import type { Finding, OverviewRow } from "./types";

/** TLS is only reported when the certificate is close to expiry, so most healthy rows have no value. */
export const TLS_WARN_DAYS = 30;

export type FleetRow = BoardSite & {
  status: SiteStatus;
  statusLabel: string;
  name: string;
  hostname: string;
  finding: string | null;
  findingExtra: string | null;
  updates: number;
  tlsDaysLeft: number | null;
  coreVersion: string | null;
  finishedAt: string | null;
  running: boolean;
  stale: boolean;
  /** Has pending updates the helper is allowed to apply, so the row's checkbox does something. */
  updatable: boolean;
};

export type FleetTable = {
  rows: FleetRow[];
  needsAttention: FleetRow[];
  healthy: FleetRow[];
  counts: { critical: number; attention: number; healthy: number; updates: number };
};

export function tlsDaysLeftOf(findings: readonly Finding[]): number | null {
  for (const finding of findings) {
    if (finding.kind === "tls_expiring" && typeof finding.daysLeft === "number") {
      return finding.daysLeft;
    }
  }
  return null;
}

/** Actionable findings that are not updates — updates have their own column. */
export function issueFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((finding) => isActionableFinding(finding) && !isUpdateFinding(finding));
}

export function fleetRow(row: OverviewRow): FleetRow {
  const overview = siteOverview(row);
  const findings = row.latest?.findings ?? [];
  const status = effectiveStatus(row);
  const issues = issueFindings(findings);
  const primary = primaryFindingOf(issues);
  const extra = issues.length - (primary ? 1 : 0);
  const helper = row.latest?.helper ?? null;
  const updates = updateCount(findings);
  return {
    row,
    overview,
    status,
    statusLabel: statusLabelOf(status, Boolean(row.running), row.latest !== null),
    name: row.site.name,
    hostname: host(row.site.origin),
    finding: primary ? primary.title : null,
    findingExtra: extra > 0 ? `+${extra}` : null,
    updates,
    tlsDaysLeft: tlsDaysLeftOf(findings),
    coreVersion: row.latest?.coreVersion ?? null,
    finishedAt: row.latest?.finishedAt ?? null,
    running: Boolean(row.running),
    stale: staleHours(row) !== null,
    updatable: updates > 0 && helperCan(helper, "update"),
  };
}

function statusLabelOf(status: SiteStatus, running: boolean, scanned: boolean): string {
  if (status === "unknown") {
    return running ? "Scanning" : scanned ? SITE_STATUS_LABEL.unknown : "Never scanned";
  }
  return status === "attention" ? "Warning" : SITE_STATUS_LABEL[status];
}

export function fleetTable(sites: readonly OverviewRow[]): FleetTable {
  const rows = sites.map(fleetRow).sort(compareBoardSites);
  const counts = { critical: 0, attention: 0, healthy: 0, updates: 0 };
  for (const row of rows) {
    if (row.status === "critical" || row.status === "attention" || row.status === "healthy") {
      counts[row.status] += 1;
    }
    counts.updates += row.updates;
  }
  return {
    rows,
    needsAttention: rows.filter((row) => row.status !== "healthy"),
    healthy: rows.filter((row) => row.status === "healthy"),
    counts,
  };
}
