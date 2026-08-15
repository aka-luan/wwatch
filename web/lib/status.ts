export const SITE_STATUSES = ["critical", "attention", "healthy", "unknown"] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  critical: "Critical",
  attention: "Attention",
  healthy: "Healthy",
  unknown: "Unknown",
};

export const STATUS_BADGE_VARIANT = {
  critical: "destructive",
  attention: "warning",
  healthy: "success",
  unknown: "secondary",
} as const satisfies Record<SiteStatus, "destructive" | "warning" | "success" | "secondary">;

export type Rollup = "never" | "running" | "ok" | "degraded" | "down" | "auth_failed";
export type Severity = "info" | "warn" | "crit";

export function siteStatusFromRollup(rollup: string): SiteStatus {
  switch (rollup) {
    case "ok":
      return "healthy";
    case "degraded":
    case "warn":
      return "attention";
    case "down":
    case "auth_failed":
    case "crit":
      return "critical";
    default:
      return "unknown";
  }
}

export function siteStatusFromSeverity(severity: string): SiteStatus {
  switch (severity) {
    case "crit":
      return "critical";
    case "warn":
      return "attention";
    default:
      return "unknown";
  }
}

export function siteStatusFromCounts(counts: { crit: number; warn: number }): SiteStatus {
  if (counts.crit > 0) {
    return "critical";
  }
  if (counts.warn > 0) {
    return "attention";
  }
  return "healthy";
}

export function siteStatusFromFindings(findings: readonly { severity: string }[]): SiteStatus {
  let crit = 0;
  let warn = 0;
  for (const finding of findings) {
    if (finding.severity === "crit") {
      crit += 1;
    } else if (finding.severity === "warn") {
      warn += 1;
    }
  }
  return siteStatusFromCounts({ crit, warn });
}

export function siteStatusOf(row: { latest: { findings: readonly { severity: string }[] } | null }): SiteStatus {
  if (!row.latest) {
    return "unknown";
  }
  return siteStatusFromFindings(row.latest.findings);
}

export function rollupLabel(value: string): string {
  return value.replaceAll("_", " ");
}
