export type SiteId = string & { readonly __brand: "SiteId" };
export type ScanId = string & { readonly __brand: "ScanId" };
export type Origin = string & { readonly __brand: "Origin" };
export type PluginRef = string & { readonly __brand: "PluginRef" };

export type PluginStatus = "active" | "inactive";
export type Severity = "info" | "warn" | "crit";
export type FinishedRollup = "ok" | "degraded" | "down" | "auth_failed";
export type Rollup = "never" | "running" | FinishedRollup;
export type HelperCapability = "login" | "update";
export type HelperInfo =
  | { kind: "missing" }
  | { kind: "installed"; version: string; capabilities: HelperCapability[] };
export type UpdateTarget =
  | { kind: "plugin"; plugin: PluginRef }
  | { kind: "theme"; theme: string }
  | { kind: "core" }
  | { kind: "all" };

const HELPER_CAPABILITIES: readonly HelperCapability[] = ["login", "update"];

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
  counts: { crit: number; warn: number; info: number };
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
  if (isBlockedOriginHost(url.hostname)) {
    throw new Error("Origin must not be a link-local or cloud metadata address");
  }
  url.hash = "";
  url.search = "";
  url.pathname = "";
  return url.origin as Origin;
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function isBlockedOriginHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (
    host === "metadata.google.internal" ||
    host.endsWith(".metadata.google.internal") ||
    host === "metadata.goog" ||
    host === "fd00:ec2::254"
  ) {
    return true;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return host.startsWith("169.254.") || host.startsWith("0.");
  }
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) {
    return isBlockedOriginHost(mapped[1]);
  }
  return host === "::" || host.startsWith("fe80:");
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
  return {
    id: snapshot.id,
    finishedAt: snapshot.finishedAt,
    rollup: snapshot.rollup,
    counts: findingCounts(snapshot.findings),
  };
}

function parseVersion(raw: string): number[] | null {
  const core = raw.trim().split(/[-+]/)[0];
  if (!core || !/^\d+(\.\d+)*$/.test(core)) {
    return null;
  }
  return core.split(".").map((part) => Number(part));
}
