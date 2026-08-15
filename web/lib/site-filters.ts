import { host } from "./format";
import { groupIdForFinding } from "./finding-groups";
import { isUpdateFinding } from "./primary-finding";
import { SITE_STATUS_LABEL, siteStatusOf } from "./status";
import type { Finding, OverviewRow } from "./types";

export const PRIMARY_STATUS_FILTERS = ["all", "critical", "attention", "healthy"] as const;

export type PrimaryStatusFilter = (typeof PRIMARY_STATUS_FILTERS)[number];

export const SECONDARY_FILTERS = ["updates", "security", "tls_expiring", "scan_failed"] as const;

export type SecondaryFilter = (typeof SECONDARY_FILTERS)[number];

export const SECONDARY_FILTER_LABEL: Record<SecondaryFilter, string> = {
  updates: "Updates",
  security: "Security",
  tls_expiring: "TLS expiring",
  scan_failed: "Scan failed",
};

export type SiteFilterState = {
  query: string;
  status: PrimaryStatusFilter;
  secondary: readonly SecondaryFilter[];
};

export type StatusFilterCounts = Record<PrimaryStatusFilter, number>;

export type SecondaryFilterCounts = Record<SecondaryFilter, number>;

export function emptyFilterState(): SiteFilterState {
  return { query: "", status: "all", secondary: [] };
}

export function filtersActive(state: SiteFilterState): boolean {
  return state.query.trim() !== "" || state.status !== "all" || state.secondary.length > 0;
}

export function primaryFilterLabel(filter: PrimaryStatusFilter): string {
  if (filter === "all") {
    return "All";
  }
  return SITE_STATUS_LABEL[filter];
}

export function statusFilterCounts(rows: readonly OverviewRow[]): StatusFilterCounts {
  const counts: StatusFilterCounts = {
    all: rows.length,
    critical: 0,
    attention: 0,
    healthy: 0,
  };
  for (const row of rows) {
    const status = siteStatusOf(row);
    if (status === "critical" || status === "attention" || status === "healthy") {
      counts[status] += 1;
    }
  }
  return counts;
}

export function secondaryFilterCounts(rows: readonly OverviewRow[]): SecondaryFilterCounts {
  const counts: SecondaryFilterCounts = {
    updates: 0,
    security: 0,
    tls_expiring: 0,
    scan_failed: 0,
  };
  for (const row of rows) {
    for (const filter of SECONDARY_FILTERS) {
      if (rowMatchesSecondary(row, filter)) {
        counts[filter] += 1;
      }
    }
  }
  return counts;
}

export function filterSites(rows: readonly OverviewRow[], state: SiteFilterState): OverviewRow[] {
  const query = state.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesStatus(row, state.status)) {
      return false;
    }
    if (query && !matchesQuery(row, query)) {
      return false;
    }
    for (const filter of state.secondary) {
      if (!rowMatchesSecondary(row, filter)) {
        return false;
      }
    }
    return true;
  });
}

function matchesStatus(row: OverviewRow, status: PrimaryStatusFilter): boolean {
  if (status === "all") {
    return true;
  }
  return siteStatusOf(row) === status;
}

function matchesQuery(row: OverviewRow, query: string): boolean {
  if (row.site.name.toLowerCase().includes(query)) {
    return true;
  }
  const hostname = host(row.site.origin).toLowerCase();
  if (hostname.includes(query)) {
    return true;
  }
  return row.site.origin.toLowerCase().includes(query);
}

export function rowMatchesSecondary(row: OverviewRow, filter: SecondaryFilter): boolean {
  const findings = row.latest?.findings ?? [];
  switch (filter) {
    case "updates":
      return findings.some(isUpdateFinding);
    case "security":
      return findings.some(isSecurityFinding);
    case "tls_expiring":
      return findings.some((finding) => finding.kind === "tls_expiring");
    case "scan_failed":
      return findings.some(isScanFailedFinding) || row.rollup === "down";
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

function isSecurityFinding(finding: Finding): boolean {
  return groupIdForFinding(finding) === "security" && (finding.severity === "crit" || finding.severity === "warn");
}

function isScanFailedFinding(finding: Finding): boolean {
  return finding.kind === "down";
}

export function toggleSecondaryFilter(
  current: readonly SecondaryFilter[],
  filter: SecondaryFilter,
): SecondaryFilter[] {
  if (current.includes(filter)) {
    return current.filter((item) => item !== filter);
  }
  return [...SECONDARY_FILTERS].filter((item) => item === filter || current.includes(item));
}

export function removeSecondaryFilter(
  current: readonly SecondaryFilter[],
  filter: SecondaryFilter,
): SecondaryFilter[] {
  return current.filter((item) => item !== filter);
}
