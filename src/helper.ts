import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScanDeps } from "./scan.js";
import type { StoredSite } from "./store.js";

const TIMEOUT_MS = 10_000;
const TOKEN_RE = /^[a-f0-9]{64}$/;
export const HELPER_PLUGIN_FILENAME = "wwatch.php";

export async function mintLoginLink(
  site: StoredSite,
  deps: ScanDeps,
): Promise<{ url: string }> {
  const hit = await postLoginLink(site, deps);
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

async function postLoginLink(
  site: StoredSite,
  deps: ScanDeps,
): Promise<{ kind: "network"; detail: string } | { kind: "http"; status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = Buffer.from(`${site.username}:${site.applicationPassword}`, "utf8").toString("base64");
  try {
    const response = await deps.fetch(`${site.origin}/wp-json/wwatch/v1/login-link`, {
      method: "POST",
      headers: {
        authorization: `Basic ${token}`,
        "cache-control": "no-store",
        "content-type": "application/json",
      },
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
