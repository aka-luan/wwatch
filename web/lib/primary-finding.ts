import type { Finding } from "./types";

const SEVERITY_WEIGHT = {
  crit: 1000,
  warn: 100,
  info: 0,
} as const;

const KIND_WEIGHT: Record<string, number> = {
  down: 90,
  not_wordpress: 88,
  rest_disabled: 86,
  auth_failed: 84,
  exposed_path: 80,
  tls_expiring: 76,
  core_checksums: 72,
  php_runtime: 68,
  core_update: 60,
  site_health: 56,
  plugin_closed: 52,
  plugin_stale: 50,
  wp_debug: 48,
  file_edit_allowed: 46,
  xmlrpc_open: 44,
  plugin_update: 40,
  theme_update: 38,
  broken_link: 30,
  rate_limited: 24,
  cron: 20,
  autoload_size: 18,
  admin_users: 16,
  updates_blocked: 14,
  hidden_code: 8,
  plugin_unknown: 4,
};

const UPDATE_KINDS = new Set(["plugin_update", "theme_update", "core_update"]);

export function isActionableFinding(finding: Finding): boolean {
  return finding.severity === "crit" || finding.severity === "warn";
}

export function isUpdateFinding(finding: Finding): boolean {
  return UPDATE_KINDS.has(finding.kind);
}

export function updateCount(findings: readonly Finding[]): number {
  return findings.filter(isUpdateFinding).length;
}

export function findingWeight(finding: Finding): number {
  return SEVERITY_WEIGHT[finding.severity] + (KIND_WEIGHT[finding.kind] ?? 0);
}

export function compareFindings(a: Finding, b: Finding): number {
  return findingWeight(b) - findingWeight(a);
}

export function primaryFindingOf(findings: readonly Finding[]): Finding | null {
  let best: Finding | null = null;
  let bestWeight = -1;
  for (const finding of findings) {
    if (!isActionableFinding(finding)) {
      continue;
    }
    const weight = findingWeight(finding);
    if (weight > bestWeight) {
      best = finding;
      bestWeight = weight;
    }
  }
  return best;
}
