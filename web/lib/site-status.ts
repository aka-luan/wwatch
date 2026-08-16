import { siteStatusOf, type SiteStatus } from "./status";

export const STALE_AFTER_HOURS = 48;

type StalenessInput = {
  latest: { finishedAt: string } | null;
  running: unknown;
};

/** Hours since the last successful scan, only when that exceeds the staleness threshold. */
export function staleHours(row: StalenessInput): number | null {
  if (!row.latest || row.running) {
    return null;
  }
  const hours = (Date.now() - Date.parse(row.latest.finishedAt)) / 3_600_000;
  return Number.isFinite(hours) && hours > STALE_AFTER_HOURS ? hours : null;
}

export function staleLabel(hours: number): string {
  const days = Math.floor(hours / 24);
  return days >= 1 ? `Not scanned in ${days} day${days === 1 ? "" : "s"}` : "Not scanned in over 48 hours";
}

/**
 * Findings-derived status, bumped to at least "attention" when the site has gone stale.
 * A site already critical or attention from findings stays that way — staleness only raises the floor.
 */
export function effectiveStatus(row: StalenessInput & { latest: { findings: readonly { severity: string }[] } | null }): SiteStatus {
  const base = siteStatusOf(row);
  if (base === "healthy" && staleHours(row) !== null) {
    return "attention";
  }
  return base;
}
