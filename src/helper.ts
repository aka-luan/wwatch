import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  helperFromCapabilities,
  type HelperInfo,
  type UpdateTarget,
} from "./domain.js";
import type { ScanDeps } from "./scan.js";
import type { StoredSite } from "./store.js";

const TIMEOUT_MS = 10_000;
const UPDATE_TIMEOUT_MS = 55_000;
const TOKEN_RE = /^[a-f0-9]{64}$/;
export const HELPER_PLUGIN_FILENAME = "wwatch.php";

export async function probeHelper(site: StoredSite, deps: ScanDeps): Promise<HelperInfo | null> {
  const hit = await helperRequest(site, deps, "/wp-json/wwatch/v1", { method: "GET" }, TIMEOUT_MS);
  if (hit.kind === "network") {
    return null;
  }
  if (hit.status === 404 || isMissingRoute(hit.body)) {
    return { kind: "missing" };
  }
  if (hit.status !== 200) {
    return null;
  }
  try {
    return helperFromCapabilities(JSON.parse(hit.body));
  } catch {
    return null;
  }
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
    const plugins = await postUpdate(site, deps, { kind: "plugins" });
    const themes = await postUpdate(site, deps, { kind: "themes" });
    return { detail: [plugins.detail, themes.detail].filter(Boolean).join(" ") };
  }
  if (target.kind === "plugin") {
    return postUpdate(site, deps, { kind: "plugin", plugin: target.plugin });
  }
  if (target.kind === "theme") {
    return postUpdate(site, deps, { kind: "theme", theme: target.theme });
  }
  return postUpdate(site, deps, { kind: "core" });
}

export function helperPluginFile(): { filename: string; body: string } {
  const path = helperPluginPath();
  return { filename: HELPER_PLUGIN_FILENAME, body: readFileSync(path, "utf8") };
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

async function postUpdate(
  site: StoredSite,
  deps: ScanDeps,
  body: Record<string, string>,
): Promise<{ detail: string }> {
  const hit = await helperRequest(
    site,
    deps,
    "/wp-json/wwatch/v1/update",
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
    throw new Error("This WordPress site needs the current wwatch plugin to update from the board.");
  }
  if (hit.status === 401) {
    throw new Error("WordPress did not accept the Application Password.");
  }
  if (hit.status === 403) {
    throw new Error(
      "This WordPress user cannot update from the board. Use an administrator Application Password.",
    );
  }
  if (hit.status !== 200) {
    throw new Error(wpErrorMessage(hit.body, `Update failed (${hit.status})`));
  }
  return { detail: updateDetail(hit.body) };
}

function updateDetail(body: string): string {
  try {
    const json = JSON.parse(body) as { detail?: unknown; ok?: unknown };
    if (typeof json.detail === "string" && json.detail.trim()) {
      return json.detail.trim();
    }
    if (json.ok === true) {
      return "Updated.";
    }
  } catch {
    return "Updated.";
  }
  return "Updated.";
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
