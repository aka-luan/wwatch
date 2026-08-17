import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareVersions,
  helperFromCapabilities,
  type Finding,
  type HelperInfo,
  type RepairTarget,
  type UpdateTarget,
} from "./domain.js";
import type { ScanDeps } from "./scan.js";
import type { StoredSite } from "./store.js";
import { zipFile } from "./zip.js";

const TIMEOUT_MS = 10_000;
const UPDATE_TIMEOUT_MS = 55_000;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const LOW_MEMORY_BYTES = 64 * 1024 * 1024;
const AUTOLOAD_WARN_BYTES = 1024 * 1024;
const NAME_CAP = 40;
export const HELPER_PLUGIN_FILENAME = "wwatch.php";
export const HELPER_PLUGIN_ZIP_FILENAME = "wwatch.zip";

export type HelperHealth = {
  php: { version: string; required: string; memoryLimit: string; memoryBytes: number | null } | null;
  wpDebug: boolean | null;
  disallowFileEdit: boolean | null;
  disallowFileMods: boolean | null;
  automaticUpdaterDisabled: boolean | null;
  checksums: { matched: number; mismatched: number; skipped: number } | null;
  muPlugins: string[];
  dropins: string[];
  cron: { disabled: boolean; missed: number } | null;
  autoloadBytes: number | null;
  users: { administrators: number; loginAdmin: boolean; id1: boolean } | null;
};

/**
 * /wp-json/wwatch/v1 is WordPress's own namespace index, so it answers 200 with route metadata
 * whether or not the plugin is there. Ask the plugin's own /status path, and fall back to the
 * namespace root with its trailing slash for helpers older than 1.3.1, which only had that.
 */
export async function probeHelper(site: StoredSite, deps: ScanDeps): Promise<HelperInfo | null> {
  const status = await probeHelperPath(site, deps, "/wp-json/wwatch/v1/status");
  if (status.kind !== "missing-route") {
    return status.helper;
  }
  const legacy = await probeHelperPath(site, deps, "/wp-json/wwatch/v1/");
  if (legacy.kind === "missing-route") {
    return { kind: "missing" };
  }
  return legacy.helper;
}

async function probeHelperPath(
  site: StoredSite,
  deps: ScanDeps,
  path: string,
): Promise<{ kind: "missing-route" } | { kind: "answer"; helper: HelperInfo | null }> {
  const hit = await helperRequest(site, deps, path, { method: "GET" }, TIMEOUT_MS);
  if (hit.kind === "network") {
    return { kind: "answer", helper: null };
  }
  if (hit.status === 404 || isMissingRoute(hit.body)) {
    return { kind: "missing-route" };
  }
  if (hit.status !== 200) {
    return { kind: "answer", helper: null };
  }
  try {
    return { kind: "answer", helper: helperFromCapabilities(JSON.parse(hit.body)) };
  } catch {
    return { kind: "answer", helper: null };
  }
}

export async function fetchHelperHealth(site: StoredSite, deps: ScanDeps): Promise<HelperHealth | null> {
  const hit = await helperRequest(site, deps, "/wp-json/wwatch/v1/health", { method: "GET" }, TIMEOUT_MS);
  if (hit.kind === "network" || hit.status !== 200) {
    return null;
  }
  if (isMissingRoute(hit.body)) {
    return null;
  }
  try {
    return parseHelperHealth(JSON.parse(hit.body));
  } catch {
    return null;
  }
}

export function parseHelperHealth(raw: unknown): HelperHealth | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  return {
    php: parsePhp(rec.php),
    wpDebug: asBool(rec.wp_debug),
    disallowFileEdit: asBool(rec.disallow_file_edit),
    disallowFileMods: asBool(rec.disallow_file_mods),
    automaticUpdaterDisabled: asBool(rec.automatic_updater_disabled),
    checksums: parseChecksums(rec.checksums),
    muPlugins: parseNames(rec.mu_plugins),
    dropins: parseNames(rec.dropins),
    cron: parseCron(rec.cron),
    autoloadBytes: asInt(rec.autoload_bytes, 0, 1_000_000_000_000),
    users: parseUsers(rec.users),
  };
}

export function findingsFromHealth(
  health: HelperHealth,
  opts: { httpsOrigin: boolean },
): Finding[] {
  const findings: Finding[] = [];
  const phpFinding = phpRuntimeFinding(health.php);
  if (phpFinding) {
    findings.push(phpFinding);
  }
  if (health.wpDebug === true && opts.httpsOrigin) {
    findings.push({
      kind: "wp_debug",
      severity: "warn",
      title: "WP_DEBUG is on",
      detail: "Debug output on an https origin looks like production.",
    });
  }
  if (health.disallowFileEdit === false) {
    findings.push({
      kind: "file_edit_allowed",
      severity: "warn",
      title: "The plugin and theme file editor is enabled",
      detail: "Set DISALLOW_FILE_EDIT so wp-admin cannot edit files on disk.",
    });
  }
  const updates = updatesBlockedFinding(health);
  if (updates) {
    findings.push(updates);
  }
  if (health.checksums && health.checksums.mismatched > 0) {
    const { matched, mismatched, skipped } = health.checksums;
    findings.push({
      kind: "core_checksums",
      severity: mismatched >= 10 ? "crit" : "warn",
      title:
        mismatched === 1
          ? "1 core file does not match wordpress.org checksums"
          : `${mismatched} core files do not match wordpress.org checksums`,
      detail: `${matched} matched, ${mismatched} mismatched, ${skipped} skipped.`,
      matched,
      mismatched,
      skipped,
    });
  }
  if (health.muPlugins.length > 0 || health.dropins.length > 0) {
    const parts: string[] = [];
    if (health.muPlugins.length) {
      parts.push(`Must-use: ${health.muPlugins.join(", ")}`);
    }
    if (health.dropins.length) {
      parts.push(`Drop-ins: ${health.dropins.join(", ")}`);
    }
    findings.push({
      kind: "hidden_code",
      severity: "info",
      title: hiddenCodeTitle(health.muPlugins, health.dropins),
      detail: parts.join(". ") + ".",
      muPlugins: health.muPlugins,
      dropins: health.dropins,
    });
  }
  const cronFinding = cronFindingFrom(health.cron);
  if (cronFinding) {
    findings.push(cronFinding);
  }
  if (health.autoloadBytes !== null && health.autoloadBytes >= AUTOLOAD_WARN_BYTES) {
    findings.push({
      kind: "autoload_size",
      severity: "warn",
      title: `Autoloaded options are ${formatBytes(health.autoloadBytes)}`,
      detail: "Options loaded on every request are above 1 MB.",
      bytes: health.autoloadBytes,
    });
  }
  const usersFinding = adminUsersFinding(health.users);
  if (usersFinding) {
    findings.push(usersFinding);
  }
  return findings;
}

function phpRuntimeFinding(php: HelperHealth["php"]): Finding | null {
  if (!php) {
    return null;
  }
  const behind = php.required ? compareVersions(php.version, php.required) === "behind" : false;
  const lowMemory =
    php.memoryBytes !== null && php.memoryBytes >= 0 && php.memoryBytes < LOW_MEMORY_BYTES;
  if (!behind && !lowMemory) {
    return null;
  }
  const parts: string[] = [];
  if (behind) {
    parts.push(`Installed core wants PHP ${php.required}.`);
  }
  if (lowMemory) {
    parts.push(`memory_limit is ${php.memoryLimit || formatBytes(php.memoryBytes ?? 0)}.`);
  }
  return {
    kind: "php_runtime",
    severity: behind ? "crit" : "warn",
    title: behind
      ? `PHP ${php.version} is below the ${php.required} WordPress requires`
      : `PHP memory_limit is ${php.memoryLimit || formatBytes(php.memoryBytes ?? 0)}`,
    detail: parts.join(" "),
    phpVersion: php.version,
    requiredPhp: php.required,
    memoryBytes: php.memoryBytes,
  };
}

function updatesBlockedFinding(health: HelperHealth): Finding | null {
  const fileMods = health.disallowFileMods === true;
  const autoUpdater = health.automaticUpdaterDisabled === true;
  if (!fileMods && !autoUpdater) {
    return null;
  }
  const parts: string[] = [];
  if (fileMods) {
    parts.push("DISALLOW_FILE_MODS is on, so Update from the board will fail.");
  }
  if (autoUpdater) {
    parts.push("AUTOMATIC_UPDATER_DISABLED is on, so WordPress will not auto-update.");
  }
  return {
    kind: "updates_blocked",
    severity: fileMods ? "warn" : "info",
    title: fileMods ? "DISALLOW_FILE_MODS is on" : "AUTOMATIC_UPDATER_DISABLED is on",
    detail: parts.join(" "),
    fileMods,
    autoUpdater,
  };
}

function cronFindingFrom(cron: HelperHealth["cron"]): Finding | null {
  if (!cron) {
    return null;
  }
  if (!cron.disabled && cron.missed <= 0) {
    return null;
  }
  const parts: string[] = [];
  if (cron.disabled) {
    parts.push("DISABLE_WP_CRON is on, so page views will not spawn cron.");
  }
  if (cron.missed > 0) {
    parts.push(
      cron.missed === 1 ? "1 cron event is overdue." : `${cron.missed} cron events are overdue.`,
    );
  }
  return {
    kind: "cron",
    severity: cron.missed > 0 ? "warn" : "info",
    title: cron.missed > 0
      ? cron.missed === 1
        ? "1 missed cron event"
        : `${cron.missed} missed cron events`
      : "WordPress cron is disabled",
    detail: parts.join(" "),
    disabled: cron.disabled,
    missed: cron.missed,
  };
}

function adminUsersFinding(users: HelperHealth["users"]): Finding | null {
  if (!users) {
    return null;
  }
  if (!users.loginAdmin && !users.id1 && users.administrators <= 1) {
    return null;
  }
  const parts: string[] = [`${users.administrators} administrator${users.administrators === 1 ? "" : "s"}.`];
  if (users.loginAdmin) {
    parts.push("A user named admin exists.");
  }
  if (users.id1) {
    parts.push("User ID 1 is still present.");
  }
  return {
    kind: "admin_users",
    severity: users.loginAdmin ? "warn" : "info",
    title: users.loginAdmin
      ? "A user named admin exists"
      : users.administrators > 1
        ? `${users.administrators} administrators`
        : "User ID 1 is still present",
    detail: parts.join(" "),
    administrators: users.administrators,
    loginAdmin: users.loginAdmin,
    userId1: users.id1,
  };
}

function hiddenCodeTitle(muPlugins: string[], dropins: string[]): string {
  if (muPlugins.length && dropins.length) {
    return "Must-use plugins and drop-ins";
  }
  if (muPlugins.length === 1) {
    return `Must-use plugin ${muPlugins[0]}`;
  }
  if (muPlugins.length > 1) {
    return `${muPlugins.length} must-use plugins`;
  }
  if (dropins.length === 1) {
    return `Drop-in ${dropins[0]}`;
  }
  return `${dropins.length} drop-ins`;
}

function parsePhp(raw: unknown): HelperHealth["php"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const version = asVersion(rec.version);
  const required = typeof rec.required === "string" ? rec.required.trim() : "";
  if (!version) {
    return null;
  }
  return {
    version,
    required,
    memoryLimit: typeof rec.memory_limit === "string" ? rec.memory_limit.trim() : "",
    memoryBytes: asInt(rec.memory_bytes, -1, 1_000_000_000_000),
  };
}

function parseChecksums(raw: unknown): HelperHealth["checksums"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const matched = asInt(rec.matched, 0, 1_000_000);
  const mismatched = asInt(rec.mismatched, 0, 1_000_000);
  const skipped = asInt(rec.skipped, 0, 1_000_000);
  if (matched === null || mismatched === null || skipped === null) {
    return null;
  }
  return { matched, mismatched, skipped };
}

function parseCron(raw: unknown): HelperHealth["cron"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const disabled = asBool(rec.disabled);
  const missed = asInt(rec.missed, 0, 99);
  if (disabled === null || missed === null) {
    return null;
  }
  return { disabled, missed };
}

function parseUsers(raw: unknown): HelperHealth["users"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const administrators = asInt(rec.administrators, 0, 100_000);
  const loginAdmin = asBool(rec.login_admin);
  const id1 = asBool(rec.id_1);
  if (administrators === null || loginAdmin === null || id1 === null) {
    return null;
  }
  return { administrators, loginAdmin, id1 };
}

function parseNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const name = item.trim();
    if (!name || name.includes("..") || name.length > 120) {
      continue;
    }
    names.push(name);
    if (names.length >= NAME_CAP) {
      break;
    }
  }
  return names;
}

function asBool(raw: unknown): boolean | null {
  return typeof raw === "boolean" ? raw : null;
}

function asInt(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  const n = Math.trunc(raw);
  if (n < min || n > max) {
    return null;
  }
  return n;
}

function asVersion(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  return raw.trim().slice(0, 32);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export async function mintLoginLink(
  site: StoredSite,
  deps: ScanDeps,
): Promise<{ url: string }> {
  const hit = await helperRequest(site, deps, "/wp-json/wwatch/v1/login-link", { method: "POST" }, TIMEOUT_MS);
  if (hit.kind === "network") {
    throw new Error(`Site did not respond: ${hit.detail}`);
  }
  if (hit.status === 404 || isMissingRoute(hit.body)) {
    throw new Error("Install the wwatch plugin on this WordPress site to log in from the board.");
  }
  if (hit.status === 401 || hit.status === 403) {
    if (hit.status === 403) {
      throw new Error(
        "This WordPress user cannot log in from the board. Use an administrator Application Password.",
      );
    }
    throw new Error("WordPress did not accept the Application Password.");
  }
  if (hit.status !== 200) {
    throw new Error(`Login link failed (${hit.status})`);
  }
  return { url: loginUrlFrom(site.origin, hit.body) };
}

export async function applyHelperUpdate(
  site: StoredSite,
  target: UpdateTarget,
  deps: ScanDeps,
): Promise<{ detail: string }> {
  if (target.kind === "all") {
    const plugins = await postHelper(site, deps, "/wp-json/wwatch/v1/update", { kind: "plugins" }, "update");
    const themes = await postHelper(site, deps, "/wp-json/wwatch/v1/update", { kind: "themes" }, "update");
    return { detail: [plugins.detail, themes.detail].filter(Boolean).join(" ") };
  }
  if (target.kind === "plugin") {
    return postHelper(site, deps, "/wp-json/wwatch/v1/update", { kind: "plugin", plugin: target.plugin }, "update");
  }
  if (target.kind === "theme") {
    return postHelper(site, deps, "/wp-json/wwatch/v1/update", { kind: "theme", theme: target.theme }, "update");
  }
  return postHelper(site, deps, "/wp-json/wwatch/v1/update", { kind: "core" }, "update");
}

export async function applyHelperRepair(
  site: StoredSite,
  target: RepairTarget,
  deps: ScanDeps,
): Promise<{ detail: string }> {
  const body = target.kind === "xmlrpc" ? { kind: "xmlrpc" } : { kind: "exposed_path", path: target.path };
  return postHelper(site, deps, "/wp-json/wwatch/v1/repair", body, "repair");
}

/**
 * WordPress's plugin uploader only takes a .zip, so ship one with the plugin in its own
 * directory — that is the layout the unzip step expects.
 */
export function helperPluginFile(): { filename: string; body: Buffer; contentType: string } {
  return {
    filename: HELPER_PLUGIN_ZIP_FILENAME,
    body: zipFile(
      [{ path: `wwatch/${HELPER_PLUGIN_FILENAME}`, body: helperPluginSource() }],
      new Date(0),
    ),
    contentType: "application/zip",
  };
}

export function helperPluginSource(): string {
  return readFileSync(helperPluginPath(), "utf8");
}

export function loginUrlFrom(origin: string, body: string): string {
  let json: { url?: unknown; token?: unknown };
  try {
    json = JSON.parse(body) as { url?: unknown; token?: unknown };
  } catch {
    throw new Error("wwatch plugin returned an unreadable login link");
  }
  const token = typeof json.token === "string" ? json.token : tokenFromUrl(json.url);
  if (!token || !TOKEN_RE.test(token)) {
    throw new Error("wwatch plugin returned an unreadable login link");
  }
  if (typeof json.url === "string") {
    let parsed: URL;
    try {
      parsed = new URL(json.url);
    } catch {
      throw new Error("wwatch plugin returned an unreadable login link");
    }
    if (parsed.origin !== new URL(origin).origin) {
      throw new Error("wwatch plugin returned a login link on a different origin");
    }
    if (parsed.searchParams.get("wwatch_login") !== token) {
      throw new Error("wwatch plugin returned an unreadable login link");
    }
    return parsed.toString();
  }
  return `${origin}/?wwatch_login=${token}`;
}

async function postHelper(
  site: StoredSite,
  deps: ScanDeps,
  path: "/wp-json/wwatch/v1/update" | "/wp-json/wwatch/v1/repair",
  body: Record<string, string>,
  verb: "update" | "repair",
): Promise<{ detail: string }> {
  const hit = await helperRequest(
    site,
    deps,
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    UPDATE_TIMEOUT_MS,
  );
  if (hit.kind === "network") {
    throw new Error(`Site did not respond: ${hit.detail}`);
  }
  if (hit.status === 404 || isMissingRoute(hit.body)) {
    throw new Error(`This WordPress site needs the current wwatch plugin to ${verb} from the board.`);
  }
  if (hit.status === 401) {
    throw new Error("WordPress did not accept the Application Password.");
  }
  if (hit.status === 403) {
    throw new Error(
      `This WordPress user cannot ${verb} from the board. Use an administrator Application Password.`,
    );
  }
  if (hit.status !== 200) {
    throw new Error(wpErrorMessage(hit.body, `${verb === "repair" ? "Repair" : "Update"} failed (${hit.status})`));
  }
  return { detail: helperDetail(hit.body, verb === "repair" ? "Repaired." : "Updated.") };
}

function helperDetail(body: string, fallback: string): string {
  try {
    const json = JSON.parse(body) as { detail?: unknown; ok?: unknown };
    if (typeof json.detail === "string" && json.detail.trim()) {
      return json.detail.trim();
    }
    if (json.ok === true) {
      return fallback;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function wpErrorMessage(body: string, fallback: string): string {
  try {
    const json = JSON.parse(body) as { message?: unknown };
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message.trim();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function tokenFromUrl(url: unknown): string | null {
  if (typeof url !== "string") {
    return null;
  }
  try {
    return new URL(url).searchParams.get("wwatch_login");
  } catch {
    return null;
  }
}

function isMissingRoute(body: string): boolean {
  try {
    const json = JSON.parse(body) as { code?: unknown };
    return json.code === "rest_no_route";
  } catch {
    return false;
  }
}

async function helperRequest(
  site: StoredSite,
  deps: ScanDeps,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ kind: "network"; detail: string } | { kind: "http"; status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = Buffer.from(`${site.username}:${site.applicationPassword}`, "utf8").toString("base64");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Basic ${token}`);
  headers.set("cache-control", "no-store");
  try {
    const response = await deps.fetch(`${site.origin}${path}`, {
      ...init,
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    return { kind: "http", status: response.status, body: await response.text() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    return { kind: "network", detail };
  } finally {
    clearTimeout(timer);
  }
}

function helperPluginPath(): string {
  const fromCwd = join(process.cwd(), "plugin", HELPER_PLUGIN_FILENAME);
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromModule = join(dirname(fileURLToPath(import.meta.url)), "..", "plugin", HELPER_PLUGIN_FILENAME);
  if (existsSync(fromModule)) {
    return fromModule;
  }
  throw new Error("wwatch plugin file is missing");
}
