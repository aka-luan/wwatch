import { randomUUID } from "node:crypto";
import tls from "node:tls";
import {
  asScanId,
  compareVersions,
  parsePluginRef,
  pluginSlug,
  rollupOf,
  type Finding,
  type InstalledPlugin,
  type PluginRef,
  type ScanSnapshot,
  type SiteId,
} from "./domain.js";
import type { StoredSite } from "./store.js";

const TIMEOUT_MS = 10_000;
const LINK_CAP = 20;
const HEALTH_TESTS = [
  "background-updates",
  "loopback-requests",
  "https-status",
  "dotorg-communication",
  "authorization-header",
] as const;

const EXPOSED_PATHS: Array<{ path: string; severity: Finding["severity"]; title: string }> = [
  { path: "/wp-config.php.bak", severity: "crit", title: "Backup wp-config is public" },
  { path: "/wp-config.php.save", severity: "crit", title: "Backup wp-config is public" },
  { path: "/wp-config.php.old", severity: "crit", title: "Backup wp-config is public" },
  { path: "/debug.log", severity: "crit", title: "debug.log is public" },
  { path: "/wp-content/debug.log", severity: "crit", title: "debug.log is public" },
  { path: "/.git/HEAD", severity: "crit", title: ".git is public" },
  { path: "/readme.html", severity: "info", title: "readme.html is public" },
  { path: "/license.txt", severity: "info", title: "license.txt is public" },
];

export type ScanDeps = {
  fetch: typeof fetch;
  now: () => Date;
  tlsDaysLeft: (host: string, port: number) => Promise<number | null>;
};

export const defaultDeps: ScanDeps = {
  fetch,
  now: () => new Date(),
  tlsDaysLeft,
};

export async function runScan(site: StoredSite, deps: ScanDeps = defaultDeps): Promise<ScanSnapshot> {
  const startedAt = deps.now().toISOString();
  const id = asScanId(randomUUID());
  const findings: Finding[] = [];
  let coreVersion: string | null = null;
  let plugins: InstalledPlugin[] = [];

  const home = await read(deps, site.origin + "/", { redirect: "follow" });
  if (home.kind === "network") {
    findings.push({
      kind: "down",
      severity: "crit",
      title: "Site did not respond",
      detail: home.detail,
    });
    return finish(id, site.id, startedAt, deps.now(), findings, null, []);
  }

  const index = await read(deps, site.origin + "/wp-json");
  if (index.kind === "http" && index.status === 404) {
    findings.push({
      kind: "rest_disabled",
      severity: "crit",
      title: "REST API is not available",
      detail: `${site.origin}/wp-json returned 404`,
    });
  } else if (index.kind === "network") {
    findings.push({
      kind: "rest_disabled",
      severity: "crit",
      title: "REST API is not reachable",
      detail: index.detail,
    });
  } else if (index.kind === "http" && !isWpIndex(index.body)) {
    findings.push({
      kind: "not_wordpress",
      severity: "crit",
      title: "This origin does not look like WordPress",
      detail: `${site.origin}/wp-json did not return a WP index`,
    });
  }

  if (home.kind === "http") {
    coreVersion = generatorVersion(home.body);
  }

  const url = new URL(site.origin);
  if (url.protocol === "https:") {
    const days = await deps.tlsDaysLeft(url.hostname, url.port ? Number(url.port) : 443);
    if (days !== null && days <= 21) {
      findings.push({
        kind: "tls_expiring",
        severity: days <= 7 ? "crit" : "warn",
        title: days < 0 ? "TLS certificate expired" : `TLS certificate expires in ${days} days`,
        detail: `${url.hostname} certificate window is ${days} days`,
        daysLeft: days,
      });
    }
  }

  const auth = await read(deps, site.origin + "/wp-json/wp/v2/plugins?context=edit", {
    headers: basic(site),
  });
  if (auth.kind === "http" && (auth.status === 401 || auth.status === 403)) {
    const explained = describeAuthFailure(auth);
    findings.push({
      kind: "auth_failed",
      severity: "crit",
      title: explained.title,
      detail: explained.detail,
    });
  } else if (auth.kind === "http" && auth.status === 429) {
    findings.push({
      kind: "rate_limited",
      severity: "warn",
      title: "REST API rate-limited the scan",
      detail: "WordPress or a security plugin returned 429",
    });
  } else if (auth.kind === "http" && auth.status === 200) {
    plugins = parsePlugins(auth.body);
    const org = await Promise.all(plugins.map((plugin) => orgPlugin(deps, plugin.slug)));
    for (const plugin of plugins) {
      const info = org.find((item) => item.slug === plugin.slug);
      if (!info || info.missing) {
        findings.push({
          kind: "plugin_unknown",
          severity: "info",
          title: `${plugin.name} is not on wordpress.org`,
          detail: "Premium, custom, or removed. Update status is unknown.",
          plugin: plugin.ref,
        });
        continue;
      }
      if (info.closed) {
        findings.push({
          kind: "plugin_closed",
          severity: "warn",
          title: `${plugin.name} is closed on wordpress.org`,
          detail: info.detail,
          plugin: plugin.ref,
        });
      }
      if (info.daysSinceUpdate !== null && info.daysSinceUpdate >= 730 && !info.closed) {
        findings.push({
          kind: "plugin_stale",
          severity: "warn",
          title: `${plugin.name} has not been updated in ${Math.floor(info.daysSinceUpdate / 365)} years`,
          detail: "Abandoned plugins are a common exploit path",
          plugin: plugin.ref,
          daysSinceUpdate: info.daysSinceUpdate,
        });
      }
      if (info.latest && compareVersions(plugin.version, info.latest) === "behind") {
        findings.push({
          kind: "plugin_update",
          severity: "warn",
          title: `${plugin.name} ${plugin.version} → ${info.latest}`,
          detail: `${plugin.ref} is behind the directory version`,
          plugin: plugin.ref,
          installed: plugin.version,
          latest: info.latest,
        });
      }
    }
    if (coreVersion) {
      const latestCore = await orgCore(deps);
      if (latestCore && compareVersions(coreVersion, latestCore) === "behind") {
        const major = coreVersion.split(".")[0] !== latestCore.split(".")[0];
        findings.push({
          kind: "core_update",
          severity: major ? "crit" : "warn",
          title: `WordPress ${coreVersion} → ${latestCore}`,
          detail: "Installed core is behind wordpress.org",
          installed: coreVersion,
          latest: latestCore,
        });
      }
    }
    for (const test of HEALTH_TESTS) {
      const health = await read(deps, `${site.origin}/wp-json/wp-site-health/v1/tests/${test}`, {
        headers: basic(site),
      });
      if (health.kind === "http" && health.status === 200) {
        const parsed = parseHealth(health.body);
        if (parsed && parsed.result !== "good") {
          findings.push({
            kind: "site_health",
            severity: parsed.result === "critical" ? "crit" : "warn",
            title: parsed.label,
            detail: stripTags(parsed.description),
            test,
            result: parsed.result,
          });
        }
      }
    }
  }

  if (home.kind === "http") {
    const links = extractSameOriginLinks(site.origin, home.body).slice(0, LINK_CAP);
    for (const href of links) {
      const hit = await read(deps, href, { method: "GET" });
      if (hit.kind === "network") {
        findings.push({
          kind: "broken_link",
          severity: "warn",
          title: "Broken link",
          detail: hit.detail,
          url: href,
          httpStatus: null,
        });
      } else if (hit.status >= 400) {
        findings.push({
          kind: "broken_link",
          severity: "warn",
          title: `Broken link (${hit.status})`,
          detail: href,
          url: href,
          httpStatus: hit.status,
        });
      }
    }
  }

  for (const probe of EXPOSED_PATHS) {
    const hit = await read(deps, site.origin + probe.path);
    if (hit.kind === "http" && hit.status === 200 && looksLikeFile(hit.body, probe.path)) {
      findings.push({
        kind: "exposed_path",
        severity: probe.severity,
        title: probe.title,
        detail: `${site.origin}${probe.path} returned 200`,
        path: probe.path,
      });
    }
  }

  const xmlrpc = await read(deps, site.origin + "/xmlrpc.php", {
    method: "POST",
    headers: { "content-type": "text/xml" },
    body: "<methodCall><methodName>system.listMethods</methodName></methodCall>",
  });
  if (xmlrpc.kind === "http" && xmlrpc.status === 200 && xmlrpc.body.includes("methodResponse")) {
    findings.push({
      kind: "xmlrpc_open",
      severity: "info",
      title: "xmlrpc.php accepts requests",
      detail: "Disable XML-RPC if you do not use it",
    });
  }

  return finish(id, site.id, startedAt, deps.now(), findings, coreVersion, plugins);
}

export async function assertConnect(site: StoredSite, deps: ScanDeps = defaultDeps): Promise<void> {
  const index = await read(deps, site.origin + "/wp-json");
  if (index.kind === "network") {
    throw new Error(`Site did not respond: ${index.detail}`);
  }
  if (index.status === 404 || !isWpIndex(index.body)) {
    throw new Error("This origin does not look like WordPress REST");
  }
  const plugins = await read(deps, site.origin + "/wp-json/wp/v2/plugins?context=edit", {
    headers: basic(site),
  });
  if (plugins.kind === "network") {
    throw new Error(`REST API did not respond: ${plugins.detail}`);
  }
  if (plugins.status === 401 || plugins.status === 403) {
    const explained = describeAuthFailure(plugins);
    throw new Error(`${explained.title}. ${explained.detail}`);
  }
  if (plugins.status !== 200) {
    throw new Error(`Plugin list returned ${plugins.status}`);
  }
}

export function describeAuthFailure(hit: { status: number; body: string; headers: Headers }): {
  title: string;
  detail: string;
} {
  const fault = wpFault(hit.body);
  const wpMessage = fault?.message ? stripTags(fault.message) : "";
  const hint = authHeaderHint(hit.headers);

  if (hit.status === 403 && fault?.code === "rest_cannot_view_plugins") {
    return {
      title: "This WordPress user cannot manage plugins",
      detail: sentences(
        "The Application Password worked, but this account cannot manage plugins.",
        "Use an administrator.",
        wpMessage,
      ),
    };
  }

  if (fault?.code === "incorrect_password" || fault?.code === "invalid_username") {
    return {
      title: "Application Password was rejected",
      detail: sentences(
        "Use your WordPress login as the username, not the name you gave the Application Password.",
        wpMessage,
      ),
    };
  }

  if (
    fault?.code === "application_passwords_disabled" ||
    fault?.code === "application_passwords_disabled_for_user"
  ) {
    return {
      title: "Application Passwords are disabled",
      detail: sentences("A security plugin or host setting is blocking Application Passwords.", wpMessage),
    };
  }

  if (hit.status === 403) {
    return {
      title: "WordPress blocked the request",
      detail: sentences(`GET /wp/v2/plugins returned 403.`, hint, wpMessage),
    };
  }

  return {
    title: "WordPress did not see the Application Password",
    detail: sentences(
      "The username must be your WordPress login, not the Application Password name.",
      hint,
      wpMessage,
    ),
  };
}

function wpFault(body: string): { code: string; message: string } | null {
  try {
    const json = JSON.parse(body) as { code?: unknown; message?: unknown };
    if (typeof json.code !== "string") {
      return null;
    }
    return { code: json.code, message: typeof json.message === "string" ? json.message : "" };
  } catch {
    return null;
  }
}

function authHeaderHint(headers: Headers): string {
  const server = (headers.get("server") ?? "").toLowerCase();
  const platform = (headers.get("platform") ?? "").toLowerCase();
  if (server === "hcdn" || platform === "hostinger") {
    return "This site is behind Hostinger CDN, which often drops the Authorization header before WordPress. In hPanel, disable CDN or exclude /wp-json.";
  }
  if (server.includes("cloudflare")) {
    return "Cloudflare is in front of this site and may be dropping the Authorization header. Allow /wp-json through the WAF, or restore the header at origin.";
  }
  return 'This host may be dropping the Authorization header. Exclude /wp-json from the CDN, or add SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1 to .htaccess.';
}

function sentences(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function daysSince(raw: string | undefined, now: Date): number | null {
  if (!raw) {
    return null;
  }
  const then = Date.parse(raw);
  if (Number.isNaN(then)) {
    return null;
  }
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export async function setPluginStatus(
  site: StoredSite,
  plugin: PluginRef,
  status: InstalledPlugin["status"],
  deps: ScanDeps = defaultDeps,
): Promise<InstalledPlugin> {
  const encoded = encodeURIComponent(plugin);
  const hit = await read(deps, `${site.origin}/wp-json/wp/v2/plugins/${encoded}`, {
    method: "POST",
    headers: { ...basic(site), "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (hit.kind === "network") {
    throw new Error(hit.detail);
  }
  if (hit.status !== 200) {
    throw new Error(`Plugin status change failed (${hit.status})`);
  }
  const parsed = parsePlugins(`[${hit.body}]`)[0];
  if (!parsed) {
    throw new Error("WordPress returned an unreadable plugin");
  }
  return parsed;
}

function finish(
  id: ScanSnapshot["id"],
  siteId: SiteId,
  startedAt: string,
  now: Date,
  findings: Finding[],
  coreVersion: string | null,
  plugins: InstalledPlugin[],
): ScanSnapshot {
  return {
    id,
    siteId,
    startedAt,
    finishedAt: now.toISOString(),
    rollup: rollupOf(findings),
    coreVersion,
    plugins,
    findings,
  };
}

function basic(site: StoredSite): { authorization: string; "cache-control": string } {
  const token = Buffer.from(`${site.username}:${site.applicationPassword}`, "utf8").toString("base64");
  return { authorization: `Basic ${token}`, "cache-control": "no-store" };
}

type Hit =
  | { kind: "network"; detail: string }
  | { kind: "http"; status: number; body: string; headers: Headers };

async function read(
  deps: ScanDeps,
  url: string,
  init: RequestInit = {},
): Promise<Hit> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await deps.fetch(url, { ...init, redirect: init.redirect ?? "manual", signal: controller.signal });
    const body = await response.text();
    return { kind: "http", status: response.status, body, headers: response.headers };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    return { kind: "network", detail };
  } finally {
    clearTimeout(timer);
  }
}

function isWpIndex(body: string): boolean {
  try {
    const json = JSON.parse(body) as { namespaces?: unknown };
    return Array.isArray(json.namespaces);
  } catch {
    return false;
  }
}

function generatorVersion(html: string): string | null {
  const meta = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+([0-9.]+)/i);
  if (meta?.[1]) {
    return meta[1];
  }
  const alt = html.match(/content=["']WordPress\s+([0-9.]+)["'][^>]+name=["']generator["']/i);
  return alt?.[1] ?? null;
}

function parsePlugins(body: string): InstalledPlugin[] {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: InstalledPlugin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.plugin !== "string" || typeof rec.name !== "string" || typeof rec.version !== "string") {
      continue;
    }
    const status = rec.status === "active" ? "active" : "inactive";
    try {
      const ref = parsePluginRef(rec.plugin);
      out.push({
        ref,
        slug: pluginSlug(ref),
        name: rec.name,
        version: rec.version,
        status,
      });
    } catch {
      continue;
    }
  }
  return out;
}

async function orgPlugin(
  deps: ScanDeps,
  slug: string,
): Promise<{
  slug: string;
  latest: string | null;
  closed: boolean;
  missing: boolean;
  detail: string;
  daysSinceUpdate: number | null;
}> {
  const url = `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${encodeURIComponent(slug)}`;
  const hit = await read(deps, url);
  if (hit.kind === "network" || hit.status === 404) {
    return { slug, latest: null, closed: false, missing: true, detail: "not in the directory", daysSinceUpdate: null };
  }
  try {
    const json = JSON.parse(hit.body) as {
      version?: string;
      error?: string;
      closed?: boolean;
      last_updated?: string;
    };
    if (json.error) {
      return { slug, latest: null, closed: false, missing: true, detail: json.error, daysSinceUpdate: null };
    }
    return {
      slug,
      latest: typeof json.version === "string" ? json.version : null,
      closed: json.closed === true,
      missing: false,
      detail: json.closed ? "Closed on wordpress.org" : "",
      daysSinceUpdate: daysSince(json.last_updated, deps.now()),
    };
  } catch {
    return {
      slug,
      latest: null,
      closed: false,
      missing: true,
      detail: "unreadable directory response",
      daysSinceUpdate: null,
    };
  }
}

async function orgCore(deps: ScanDeps): Promise<string | null> {
  const hit = await read(deps, "https://api.wordpress.org/core/version-check/1.7/");
  if (hit.kind !== "http" || hit.status !== 200) {
    return null;
  }
  try {
    const json = JSON.parse(hit.body) as { offers?: Array<{ current?: string; version?: string }> };
    const offer = json.offers?.[0];
    return offer?.current ?? offer?.version ?? null;
  } catch {
    return null;
  }
}

function parseHealth(body: string): { result: "good" | "recommended" | "critical"; label: string; description: string } | null {
  try {
    const json = JSON.parse(body) as { status?: string; label?: string; description?: string };
    if (json.status !== "good" && json.status !== "recommended" && json.status !== "critical") {
      return null;
    }
    return {
      result: json.status,
      label: typeof json.label === "string" ? json.label : json.status,
      description: typeof json.description === "string" ? json.description : "",
    };
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractSameOriginLinks(origin: string, html: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).filter((h): h is string => !!h);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const href of hrefs) {
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.origin !== origin) {
      continue;
    }
    if (abs.pathname.includes("wp-admin") || abs.pathname.includes("wp-login") || abs.pathname.includes("logout")) {
      continue;
    }
    const key = abs.origin + abs.pathname;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(abs.toString());
  }
  return out;
}

function looksLikeFile(body: string, path: string): boolean {
  if (path.endsWith("HEAD")) {
    return body.startsWith("ref:");
  }
  if (path.includes("wp-config")) {
    return body.includes("DB_NAME") || body.includes("table_prefix");
  }
  if (path.includes("debug.log")) {
    return body.includes("[") && body.toLowerCase().includes("php");
  }
  if (path.endsWith("readme.html")) {
    return /wordpress/i.test(body);
  }
  if (path.endsWith("license.txt")) {
    return /gnu general public license/i.test(body);
  }
  return body.length > 0 && !/not found|404/i.test(body.slice(0, 200));
}

export function tlsDaysLeft(host: string, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) {
        resolve(null);
        return;
      }
      resolve(Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86_400_000));
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}
