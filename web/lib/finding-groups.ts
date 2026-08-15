import { compareFindings, findingWeight, isActionableFinding, isUpdateFinding } from "./primary-finding";
import { siteStatusFromSeverity, type SiteStatus } from "./status";
import type { Finding } from "./types";

export const FINDING_GROUPS = ["security", "updates", "reliability", "wordpress"] as const;

export type FindingGroupId = (typeof FINDING_GROUPS)[number];

export const FINDING_GROUP_LABEL: Record<FindingGroupId, string> = {
  security: "Security",
  updates: "Updates",
  reliability: "Reliability",
  wordpress: "WordPress",
};

const GROUP_BY_KIND: Record<string, FindingGroupId> = {
  exposed_path: "security",
  xmlrpc_open: "security",
  wp_debug: "security",
  file_edit_allowed: "security",
  core_checksums: "security",
  plugin_closed: "security",
  plugin_stale: "security",
  admin_users: "security",
  plugin_update: "updates",
  theme_update: "updates",
  core_update: "updates",
  down: "reliability",
  tls_expiring: "reliability",
  broken_link: "reliability",
  cron: "reliability",
  autoload_size: "reliability",
  rest_disabled: "wordpress",
  not_wordpress: "wordpress",
  auth_failed: "wordpress",
  rate_limited: "wordpress",
  site_health: "wordpress",
  plugin_unknown: "wordpress",
  php_runtime: "wordpress",
  hidden_code: "wordpress",
  updates_blocked: "wordpress",
};

export type DisplayFinding = {
  id: string;
  status: SiteStatus;
  statusLabel?: string;
  title: string;
  detail?: string;
  compact: boolean;
  showStatus: boolean;
  findings: Finding[];
};

export type FindingSection = {
  id: FindingGroupId;
  label: string;
  items: DisplayFinding[];
};

export function groupIdForFinding(finding: Finding): FindingGroupId {
  return GROUP_BY_KIND[finding.kind] ?? "wordpress";
}

export function findingDisplayCopy(finding: Finding): { title: string; detail?: string } {
  if (isUpdateFinding(finding)) {
    return updateCopy(finding);
  }
  if (finding.kind === "exposed_path") {
    return { title: finding.title, detail: exposedPathDetail(finding) };
  }
  if (finding.kind === "broken_link") {
    return { title: finding.title, detail: finding.url ?? finding.detail };
  }
  const detail = finding.detail && finding.detail !== finding.title ? finding.detail : undefined;
  return { title: finding.title, detail };
}

export function siteFindingSections({
  origin,
  findings,
  scanned,
}: {
  origin: string;
  findings: readonly Finding[];
  scanned: boolean;
}): FindingSection[] {
  const buckets: Record<FindingGroupId, DisplayFinding[]> = {
    security: [],
    updates: [],
    reliability: [],
    wordpress: [],
  };

  const broken: Finding[] = [];
  for (const finding of findings) {
    if (finding.kind === "broken_link") {
      broken.push(finding);
      continue;
    }
    buckets[groupIdForFinding(finding)].push(toDisplayFinding(finding));
  }
  if (broken.length) {
    buckets.reliability.push(collapsedBrokenLinks(broken));
  }
  if (scanned) {
    buckets.reliability.push(...reliabilityHealth(origin, findings));
  }

  return FINDING_GROUPS.flatMap((id) => {
    const items = [...buckets[id]].sort(compareDisplayFindings);
    if (!items.length) {
      return [];
    }
    return [{ id, label: FINDING_GROUP_LABEL[id], items }];
  });
}

function toDisplayFinding(finding: Finding): DisplayFinding {
  const copy = findingDisplayCopy(finding);
  return {
    id: `${finding.kind}:${finding.title}:${finding.detail}:${finding.path ?? finding.plugin ?? finding.theme ?? finding.url ?? ""}`,
    status: siteStatusFromSeverity(finding.severity),
    statusLabel: severityLabel(finding.severity),
    title: copy.title,
    detail: copy.detail,
    compact: false,
    showStatus: !isUpdateFinding(finding) || finding.severity === "crit",
    findings: [finding],
  };
}

function collapsedBrokenLinks(links: Finding[]): DisplayFinding {
  const sorted = [...links].sort(compareFindings);
  const first = sorted[0];
  if (links.length === 1 && first) {
    const copy = findingDisplayCopy(first);
    return {
      id: `broken_link:${first.url ?? first.detail}`,
      status: siteStatusFromSeverity(first.severity),
      statusLabel: severityLabel(first.severity),
      title: copy.title,
      detail: copy.detail,
      compact: false,
      showStatus: true,
      findings: sorted,
    };
  }
  return {
    id: "broken_link:aggregate",
    status: "attention",
    statusLabel: "Attention",
    title: `${links.length} broken links`,
    compact: false,
    showStatus: true,
    findings: sorted,
  };
}

function reliabilityHealth(origin: string, findings: readonly Finding[]): DisplayFinding[] {
  const kinds = new Set(findings.map((finding) => finding.kind));
  const items: DisplayFinding[] = [];
  if (!kinds.has("down")) {
    items.push({
      id: "health:reachable",
      status: "healthy",
      title: "Site reachable",
      compact: true,
      showStatus: false,
      findings: [],
    });
  }
  if (isHttps(origin) && !kinds.has("down") && !kinds.has("tls_expiring")) {
    items.push({
      id: "health:tls",
      status: "healthy",
      title: "TLS valid",
      compact: true,
      showStatus: false,
      findings: [],
    });
  }
  return items;
}

function updateCopy(finding: Finding): { title: string; detail?: string } {
  if (finding.installed && finding.latest) {
    const suffix = ` ${finding.installed} → ${finding.latest}`;
    if (finding.title.endsWith(suffix)) {
      return { title: finding.title.slice(0, -suffix.length), detail: `${finding.installed} → ${finding.latest}` };
    }
    return { title: finding.title, detail: `${finding.installed} → ${finding.latest}` };
  }
  const match = /^(.*)\s+(\S+)\s+→\s+(\S+)$/.exec(finding.title);
  if (match?.[1] && match[2] && match[3]) {
    return { title: match[1], detail: `${match[2]} → ${match[3]}` };
  }
  return { title: finding.title, detail: finding.detail };
}

function exposedPathDetail(finding: Finding): string {
  const path = finding.path ?? "";
  if (path.includes("debug.log")) {
    return "Potential information exposure.";
  }
  if (path.includes("wp-config")) {
    return "A backup of wp-config.php is reachable.";
  }
  if (path.includes(".git")) {
    return "Git metadata is reachable from the web.";
  }
  if (path.endsWith("readme.html")) {
    return "readme.html advertises the WordPress version.";
  }
  if (path.endsWith("license.txt")) {
    return "license.txt is reachable from the web.";
  }
  return finding.detail;
}

function compareDisplayFindings(a: DisplayFinding, b: DisplayFinding): number {
  if (a.compact !== b.compact) {
    return a.compact ? 1 : -1;
  }
  const aActionable = a.findings.some(isActionableFinding);
  const bActionable = b.findings.some(isActionableFinding);
  if (aActionable !== bActionable) {
    return aActionable ? -1 : 1;
  }
  return Math.max(0, ...b.findings.map(findingWeight)) - Math.max(0, ...a.findings.map(findingWeight));
}

function isHttps(origin: string): boolean {
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return origin.startsWith("https:");
  }
}

function severityLabel(severity: Finding["severity"]): string {
  if (severity === "crit") {
    return "Critical";
  }
  if (severity === "warn") {
    return "Attention";
  }
  return "Info";
}
