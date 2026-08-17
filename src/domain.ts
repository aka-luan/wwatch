export type SiteId = string & { readonly __brand: "SiteId" };
export type ScanId = string & { readonly __brand: "ScanId" };
export type Origin = string & { readonly __brand: "Origin" };
export type PluginRef = string & { readonly __brand: "PluginRef" };

export type PluginStatus = "active" | "inactive";
export type Severity = "info" | "warn" | "crit";
export type FinishedRollup = "ok" | "degraded" | "down" | "auth_failed";
export type Rollup = "never" | "running" | FinishedRollup;
export type HelperCapability = "login" | "update" | "repair";
export type HelperInfo =
  | { kind: "missing" }
  | { kind: "installed"; version: string; capabilities: HelperCapability[] };
export type UpdateTarget =
  | { kind: "plugin"; plugin: PluginRef }
  | { kind: "theme"; theme: string }
  | { kind: "core" }
  | { kind: "all" };
export const REPAIRABLE_PATHS = [
  "/debug.log",
  "/wp-content/debug.log",
  "/readme.html",
  "/license.txt",
  "/wp-config.php.bak",
  "/wp-config.php.save",
  "/wp-config.php.old",
] as const;
export type RepairablePath = (typeof REPAIRABLE_PATHS)[number];
export type RepairTarget = { kind: "exposed_path"; path: RepairablePath } | { kind: "xmlrpc" };

const HELPER_CAPABILITIES: readonly HelperCapability[] = ["login", "update", "repair"];

export type Site = {
  id: SiteId;
  name: string;
  origin: Origin;
};

export type ConnectInput = {
  name: string;
  origin: string;
  username: string;
  applicationPassword: string;
};

export type UpdateInput = {
  name?: string;
  username?: string;
  applicationPassword?: string;
};

export type InstalledPlugin = {
  ref: PluginRef;
  slug: string;
  name: string;
  version: string;
  status: PluginStatus;
};

export type Finding =
  | { kind: "down"; severity: "crit"; title: string; detail: string }
  | { kind: "not_wordpress"; severity: "crit"; title: string; detail: string }
  | { kind: "auth_failed"; severity: "crit"; title: string; detail: string }
  | { kind: "rest_disabled"; severity: "crit"; title: string; detail: string }
  | { kind: "rate_limited"; severity: "warn"; title: string; detail: string }
  | { kind: "tls_expiring"; severity: "warn" | "crit"; title: string; detail: string; daysLeft: number }
  | {
      kind: "core_update";
      severity: "warn" | "crit";
      title: string;
      detail: string;
      installed: string;
      latest: string;
    }
  | {
      kind: "plugin_update";
      severity: "warn";
      title: string;
      detail: string;
      plugin: PluginRef;
      installed: string;
      latest: string;
    }
  | { kind: "plugin_unknown"; severity: "info"; title: string; detail: string; plugin: PluginRef }
  | { kind: "plugin_closed"; severity: "warn"; title: string; detail: string; plugin: PluginRef }
  | {
      kind: "plugin_stale";
      severity: "warn";
      title: string;
      detail: string;
      plugin: PluginRef;
      daysSinceUpdate: number;
    }
  | {
      kind: "theme_update";
      severity: "warn";
      title: string;
      detail: string;
      theme: string;
      installed: string;
      latest: string;
    }
  | { kind: "broken_link"; severity: "warn"; title: string; detail: string; url: string; httpStatus: number | null }
  | { kind: "exposed_path"; severity: "info" | "warn" | "crit"; title: string; detail: string; path: string }
  | { kind: "xmlrpc_open"; severity: "info"; title: string; detail: string }
  | {
      kind: "site_health";
      severity: "info" | "warn" | "crit";
      title: string;
      detail: string;
      test: string;
      result: "good" | "recommended" | "critical";
    }
  | {
      kind: "php_runtime";
      severity: "warn" | "crit";
      title: string;
      detail: string;
      phpVersion: string;
      requiredPhp: string;
      memoryBytes: number | null;
    }
  | { kind: "wp_debug"; severity: "warn"; title: string; detail: string }
  | { kind: "file_edit_allowed"; severity: "warn"; title: string; detail: string }
  | {
      kind: "updates_blocked";
      severity: "info" | "warn";
      title: string;
      detail: string;
      fileMods: boolean;
      autoUpdater: boolean;
    }
  | {
      kind: "core_checksums";
      severity: "warn" | "crit";
      title: string;
      detail: string;
      matched: number;
      mismatched: number;
      skipped: number;
    }
  | {
      kind: "hidden_code";
      severity: "info";
      title: string;
      detail: string;
      muPlugins: string[];
      dropins: string[];
    }
  | {
      kind: "cron";
      severity: "info" | "warn";
      title: string;
      detail: string;
      disabled: boolean;
      missed: number;
    }
  | { kind: "autoload_size"; severity: "warn"; title: string; detail: string; bytes: number }
  | {
      kind: "admin_users";
      severity: "info" | "warn";
      title: string;
      detail: string;
      administrators: number;
      loginAdmin: boolean;
      userId1: boolean;
    };

export type ScanSnapshot = {
  id: ScanId;
  siteId: SiteId;
  startedAt: string;
  finishedAt: string;
  rollup: FinishedRollup;
  coreVersion: string | null;
  plugins: InstalledPlugin[];
  findings: Finding[];
  helper: HelperInfo | null;
};

export type RunningScan = { id: ScanId; startedAt: string };

export type OverviewRow = {
  site: Site;
  latest: ScanSnapshot | null;
  running: RunningScan | null;
  rollup: Rollup;
};

export type ScanSummary = {
  id: ScanId;
  finishedAt: string;
  rollup: FinishedRollup;
  counts: { crit: number; warn: number; info: number; updates: number };
};

export type SitePage = OverviewRow & {
  username: string;
  history: ScanSummary[];
};

export function asSiteId(value: string): SiteId {
  return value as SiteId;
}

export function asScanId(value: string): ScanId {
  return value as ScanId;
}

export function parseOrigin(raw: string, opts?: { allowHttp?: boolean }): Origin {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Origin must be an absolute URL");
  }
  const local = isLoopbackHost(url.hostname);
  const allowHttp = opts?.allowHttp ?? local;
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("Origin must be https");
  }
  if (url.username || url.password) {
    throw new Error("Origin must not include credentials");
  }
  if (!local && isBlockedOriginHost(url.hostname)) {
    throw new Error("Origin must not be a private, link-local, or cloud metadata address");
  }
  url.hash = "";
  url.search = "";
  url.pathname = "";
  return url.origin as Origin;
}

export function isLoopbackHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return host === "localhost" || host === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
}

function isBlockedOriginHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (
    host === "metadata.google.internal" ||
    host.endsWith(".metadata.google.internal") ||
    host === "metadata.goog"
  ) {
    return true;
  }
  return isBlockedAddress(host);
}

/**
 * Reserved and private space the board must never be pointed at. Loopback is the one exception:
 * `npm run verify` and local WordPress installs live there, and parseOrigin only reaches this
 * for a non-loopback host.
 */
export function isBlockedAddress(raw: string): boolean {
  const host = normalizeHost(raw);
  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped?.[1]) {
    return isBlockedAddress(mapped[1]);
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return isBlockedIpv4(host);
  }
  if (host.includes(":")) {
    return isBlockedIpv6(host);
  }
  return false;
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  const [a = 0, b = 0, c = 0] = parts;
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  if (a === 0 || a === 10 || a === 127) {
    return true; // this network, RFC1918, loopback
  }
  if (a === 169 && b === 254) {
    return true; // link-local, which covers the AWS/Azure metadata address
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true; // RFC1918
  }
  if (a === 192 && b === 168) {
    return true; // RFC1918
  }
  if (a === 192 && b === 0 && (c === 0 || c === 2)) {
    return true; // IETF protocol assignments, TEST-NET-1
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true; // CGNAT
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true; // benchmarking
  }
  if (a === 198 && b === 51 && c === 100) {
    return true; // TEST-NET-2
  }
  if (a === 203 && b === 0 && c === 113) {
    return true; // TEST-NET-3
  }
  return a >= 224; // multicast and reserved
}

function isBlockedIpv6(host: string): boolean {
  if (host === "::" || host === "::1" || host === "fd00:ec2::254") {
    return true;
  }
  // URL parsing rewrites ::ffff:10.0.0.5 as ::ffff:a00:5, so unpack the v4 address back out.
  const hextets = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hextets?.[1] && hextets[2]) {
    const high = Number.parseInt(hextets[1], 16);
    const low = Number.parseInt(hextets[2], 16);
    return isBlockedIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return /^(f[cd]|fe[89ab])/i.test(host); // unique-local and link-local
}

export function parsePluginRef(raw: string): PluginRef {
  const trimmed = raw.trim().replace(/\\/g, "/");
  if (!trimmed.includes("/") || trimmed.startsWith("/") || trimmed.includes("..")) {
    throw new Error("Plugin ref must look like directory/file.php");
  }
  return trimmed as PluginRef;
}

export function pluginSlug(ref: PluginRef): string {
  const dir = ref.split("/")[0];
  if (!dir) {
    throw new Error("Plugin ref missing directory");
  }
  return dir;
}

export function parseThemeSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new Error("Theme slug must look like a stylesheet directory");
  }
  return trimmed;
}

export function parseUpdateTarget(body: Record<string, unknown>): UpdateTarget {
  const kind = body.kind;
  if (kind === "core") {
    return { kind: "core" };
  }
  if (kind === "all") {
    return { kind: "all" };
  }
  if (kind === "plugin") {
    return { kind: "plugin", plugin: parsePluginRef(String(body.plugin ?? "")) };
  }
  if (kind === "theme") {
    return { kind: "theme", theme: parseThemeSlug(String(body.theme ?? "")) };
  }
  throw new Error("Update kind must be plugin, theme, core, or all");
}

export function parseRepairTarget(body: Record<string, unknown>): RepairTarget {
  const kind = body.kind;
  if (kind === "xmlrpc") {
    return { kind: "xmlrpc" };
  }
  if (kind === "exposed_path") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!isRepairablePath(path)) {
      throw new Error("This path cannot be repaired from the board");
    }
    return { kind: "exposed_path", path };
  }
  throw new Error("Repair kind must be exposed_path or xmlrpc");
}

export function isRepairablePath(path: string): path is RepairablePath {
  if (!path.startsWith("/") || path.includes("..") || path.includes("\\") || path.includes("//")) {
    return false;
  }
  return (REPAIRABLE_PATHS as readonly string[]).includes(path);
}

export function parseHelperInfo(raw: unknown): HelperInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (!("kind" in raw) || typeof raw.kind !== "string") {
    return null;
  }
  if (raw.kind === "missing") {
    return { kind: "missing" };
  }
  if (raw.kind !== "installed") {
    return null;
  }
  if (!("version" in raw) || typeof raw.version !== "string" || !raw.version.trim()) {
    return null;
  }
  const capabilities: HelperCapability[] = [];
  if ("capabilities" in raw && Array.isArray(raw.capabilities)) {
    for (const item of raw.capabilities) {
      if (typeof item === "string" && isHelperCapability(item) && !capabilities.includes(item)) {
        capabilities.push(item);
      }
    }
  }
  return { kind: "installed", version: raw.version.trim(), capabilities };
}

export function helperFromCapabilities(raw: unknown): HelperInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (!("version" in raw) || typeof raw.version !== "string" || !raw.version.trim()) {
    return null;
  }
  const capabilities: HelperCapability[] = [];
  if ("capabilities" in raw && Array.isArray(raw.capabilities)) {
    for (const item of raw.capabilities) {
      if (typeof item === "string" && isHelperCapability(item) && !capabilities.includes(item)) {
        capabilities.push(item);
      }
    }
  }
  return { kind: "installed", version: raw.version.trim(), capabilities };
}

export function helperCan(helper: HelperInfo | null, capability: HelperCapability): boolean {
  return helper?.kind === "installed" && helper.capabilities.includes(capability);
}

function isHelperCapability(value: string): value is HelperCapability {
  return HELPER_CAPABILITIES.some((item) => item === value);
}

export function compareVersions(
  installed: string,
  latest: string,
): "behind" | "current" | "ahead" | "incomparable" {
  const a = parseVersion(installed);
  const b = parseVersion(latest);
  if (!a || !b) {
    return "incomparable";
  }
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left < right) {
      return "behind";
    }
    if (left > right) {
      return "ahead";
    }
  }
  return "current";
}

export function rollupOf(findings: Finding[]): FinishedRollup {
  if (findings.some((f) => f.kind === "down" || f.kind === "not_wordpress" || f.kind === "rest_disabled")) {
    return "down";
  }
  if (findings.some((f) => f.kind === "auth_failed")) {
    return "auth_failed";
  }
  if (findings.some((f) => f.severity === "crit" || f.severity === "warn")) {
    return "degraded";
  }
  return "ok";
}

export function displayRollup(row: { latest: ScanSnapshot | null; running: RunningScan | null }): Rollup {
  if (row.latest) {
    return row.latest.rollup;
  }
  if (row.running) {
    return "running";
  }
  return "never";
}

export function findingCounts(findings: Finding[]): { crit: number; warn: number; info: number } {
  const counts = { crit: 0, warn: 0, info: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

export function scanSummary(snapshot: ScanSnapshot): ScanSummary {
  const counts = findingCounts(snapshot.findings);
  return {
    id: snapshot.id,
    finishedAt: snapshot.finishedAt,
    rollup: snapshot.rollup,
    counts: { ...counts, updates: updateFindingCount(snapshot.findings) },
  };
}

function updateFindingCount(findings: Finding[]): number {
  let updates = 0;
  for (const finding of findings) {
    if (finding.kind === "plugin_update" || finding.kind === "theme_update" || finding.kind === "core_update") {
      updates += 1;
    }
  }
  return updates;
}

function parseVersion(raw: string): number[] | null {
  const core = raw.trim().split(/[-+]/)[0];
  if (!core || !/^\d+(\.\d+)*$/.test(core)) {
    return null;
  }
  return core.split(".").map((part) => Number(part));
}
