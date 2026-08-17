import { compareFindings, findingWeight, isActionableFinding, isUpdateFinding } from "./primary-finding";
import { siteStatusFromSeverity, type SiteStatus } from "./status";
import type { Finding } from "./types";

export const FINDING_GROUPS = ["security", "updates", "reliability", "wordpress"] as const;

export type FindingGroupId = (typeof FINDING_GROUPS)[number];

export const DISPLAY_SECTIONS = ["attention", "updates", "reliability", "security", "wordpress"] as const;

export type DisplaySectionId = (typeof DISPLAY_SECTIONS)[number];

export const DISPLAY_SECTION_LABEL: Record<DisplaySectionId, string> = {
  attention: "Needs attention",
  updates: "Updates",
  reliability: "Reliability",
  security: "Security",
  wordpress: "WordPress",
};

export type FindingTone = "actionable" | "update" | "info" | "positive";

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
  explanation?: string;
  detail?: string;
  compact: boolean;
  showStatus: boolean;
  tone: FindingTone;
  findings: Finding[];
};

export type FindingSection = {
  id: DisplaySectionId;
  label: string;
  items: DisplayFinding[];
};

export function groupIdForFinding(finding: Finding): FindingGroupId {
  return GROUP_BY_KIND[finding.kind] ?? "wordpress";
}

export function sectionIdForFinding(finding: Finding): DisplaySectionId {
  if (isUpdateFinding(finding)) {
    return "updates";
  }
  if (isActionableFinding(finding)) {
    return "attention";
  }
  const group = groupIdForFinding(finding);
  if (group === "updates") {
    return "updates";
  }
  return group;
}

export function findingDisplayCopy(finding: Finding): {
  title: string;
  explanation?: string;
  detail?: string;
} {
  if (isUpdateFinding(finding)) {
    return updateCopy(finding);
  }
  if (finding.kind === "exposed_path") {
    const explanation = exposedPathDetail(finding);
    const diagnostic = diagnosticDetail(finding, explanation);
    return { title: finding.title, explanation, ...(diagnostic ? { detail: diagnostic } : {}) };
  }
  if (finding.kind === "broken_link") {
    return { title: finding.title, explanation: finding.url ?? finding.detail };
  }
  const explanation = finding.detail && finding.detail !== finding.title ? finding.detail : undefined;
  return { title: finding.title, ...(explanation ? { explanation } : {}) };
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
  const buckets: Record<DisplaySectionId, DisplayFinding[]> = {
    attention: [],
    updates: [],
    reliability: [],
    security: [],
    wordpress: [],
  };

  const broken: Finding[] = [];
  for (const finding of findings) {
    if (finding.kind === "broken_link") {
      broken.push(finding);
      continue;
    }
    buckets[sectionIdForFinding(finding)].push(toDisplayFinding(finding));
  }
  if (broken.length) {
    buckets.attention.push(collapsedBrokenLinks(broken));
  }
  if (scanned) {
    buckets.reliability.push(...reliabilityHealth(origin, findings));
  }

  return DISPLAY_SECTIONS.flatMap((id) => {
    const items = dedupeDisplayFindings([...buckets[id]].sort(compareDisplayFindings));
    if (!items.length) {
      return [];
    }
    return [{ id, label: DISPLAY_SECTION_LABEL[id], items }];
  });
}

export type ActionabilityGroups = {
  /** Actionable findings and pending updates, most severe first — each carries its own action. */
  needsAction: DisplayFinding[];
  /** Non-actionable info findings, collapsed behind a single count in the UI. */
  informational: DisplayFinding[];
};

/**
 * Groups findings by whether they need action, not by scanner category — for the row's inline
 * expansion, where "what do I do next" matters more than which subsystem found it.
 */
export function siteActionabilityGroups(findings: readonly Finding[]): ActionabilityGroups {
  const needsAction: DisplayFinding[] = [];
  const informational: DisplayFinding[] = [];
  const broken: Finding[] = [];

  for (const finding of findings) {
    if (finding.kind === "broken_link") {
      broken.push(finding);
      continue;
    }
    const display = toDisplayFinding(finding);
    (display.tone === "info" ? informational : needsAction).push(display);
  }
  if (broken.length) {
    needsAction.push(collapsedBrokenLinks(broken));
  }

  return {
    needsAction: dedupeDisplayFindings(needsAction).sort(compareDisplayFindings),
    informational: dedupeDisplayFindings(informational).sort(compareDisplayFindings),
  };
}

function toDisplayFinding(finding: Finding): DisplayFinding {
  const copy = findingDisplayCopy(finding);
  const tone = toneOf(finding);
  return {
    id: `${finding.kind}:${finding.title}:${finding.detail}:${finding.path ?? finding.plugin ?? finding.theme ?? finding.url ?? ""}`,
    status: siteStatusFromSeverity(finding.severity),
    statusLabel: severityLabel(finding.severity),
    title: copy.title,
    explanation: copy.explanation,
    detail: copy.detail,
    compact: tone === "positive" || tone === "info",
    showStatus: tone === "actionable",
    tone,
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
      explanation: copy.explanation,
      detail: copy.detail,
      compact: false,
      showStatus: true,
      tone: "actionable",
      findings: sorted,
    };
  }
  return {
    id: "broken_link:aggregate",
    status: "attention",
    statusLabel: "Warning",
    title: `${links.length} broken links`,
    detail: sorted.map((link) => `${link.url ?? link.detail}${link.httpStatus ? ` (${link.httpStatus})` : ""}`).join("; "),
    compact: false,
    showStatus: true,
    tone: "actionable",
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
      tone: "positive",
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
      tone: "positive",
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

function diagnosticDetail(finding: Finding, explanation: string | undefined): string | undefined {
  const raw = finding.detail?.trim();
  if (!raw || raw === finding.title || raw === explanation) {
    return undefined;
  }
  return raw;
}

function toneOf(finding: Finding): FindingTone {
  if (isUpdateFinding(finding)) {
    return "update";
  }
  if (isActionableFinding(finding)) {
    return "actionable";
  }
  return "info";
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

function dedupeDisplayFindings(items: DisplayFinding[]): DisplayFinding[] {
  const seen = new Set<string>();
  const out: DisplayFinding[] = [];
  for (const item of items) {
    if (
      item.compact ||
      item.findings.some(
        (finding) => isUpdateFinding(finding) || finding.kind === "broken_link" || finding.kind === "exposed_path",
      )
    ) {
      out.push(item);
      continue;
    }
    const key = `${item.title}:${item.statusLabel ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
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
    return "Warning";
  }
  return "Info";
}
