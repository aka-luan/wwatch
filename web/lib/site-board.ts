import { siteOverview, type SiteOverview } from "./site-overview";
import type { SiteStatus } from "./status";
import type { OverviewRow } from "./types";

export const HEALTHY_COLLAPSE_AFTER = 6;

export const BOARD_STATUS_ORDER = ["critical", "attention", "unknown", "healthy"] as const;

const STATUS_RANK = Object.fromEntries(BOARD_STATUS_ORDER.map((status, index) => [status, index])) as Record<
  SiteStatus,
  number
>;

export type BoardSite = {
  row: OverviewRow;
  overview: SiteOverview;
};

export type SiteBoard = {
  needsAttention: BoardSite[];
  healthy: BoardSite[];
  allHealthy: boolean;
  collapseHealthy: boolean;
};

export function compareBoardSites(a: BoardSite, b: BoardSite): number {
  const rank = STATUS_RANK[a.overview.status] - STATUS_RANK[b.overview.status];
  if (rank !== 0) {
    return rank;
  }
  const recency = recencyOf(b) - recencyOf(a);
  if (recency !== 0) {
    return recency;
  }
  const byName = a.row.site.name.localeCompare(b.row.site.name, "en", {
    numeric: true,
    sensitivity: "base",
  });
  if (byName !== 0) {
    return byName;
  }
  return a.row.site.id.localeCompare(b.row.site.id);
}

/** Most recent activity first: a running scan's start, else the last finished scan. 0 when neither exists. */
function recencyOf(item: BoardSite): number {
  const iso = item.row.running?.startedAt ?? item.row.latest?.finishedAt ?? null;
  if (!iso) {
    return 0;
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function siteBoard(rows: readonly OverviewRow[]): SiteBoard {
  const items = rows.map((row) => ({ row, overview: siteOverview(row) })).sort(compareBoardSites);
  const needsAttention = items.filter((item) => item.overview.status !== "healthy");
  const healthy = items.filter((item) => item.overview.status === "healthy");
  return {
    needsAttention,
    healthy,
    allHealthy: rows.length > 0 && needsAttention.length === 0,
    collapseHealthy: healthy.length > HEALTHY_COLLAPSE_AFTER,
  };
}
