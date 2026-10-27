import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isLoopbackHost } from "./domain.js";

/**
 * The Node entry's WATCH_SECRET. Without one, Application Passwords would be stored as plaintext
 * (or sealed under the board password), so a file-backed board mints a secret on first start and
 * keeps it beside the database. The existing reseal pass then upgrades any older rows. A shared
 * Turso database gets no generated secret: every instance must agree on it, so it has to be set.
 */
export function ensureWatchSecret(env: NodeJS.Dict<string> = process.env): string {
  const existing = env.WATCH_SECRET?.trim();
  if (existing) {
    return existing;
  }
  if (env.TURSO_DATABASE_URL) {
    throw new Error("Set WATCH_SECRET (32+ random bytes, not the board password) when using TURSO_DATABASE_URL");
  }
  const path = secretPath(env.WATCH_DB ?? "data/watch.db");
  const secret = readSecret(path) ?? writeSecret(path);
  env.WATCH_SECRET = secret;
  return secret;
}

/** A board reachable from other machines must have a password; it holds admin credentials. */
export function assertExposureSafe(host: string, dashboardPassword: string): void {
  if (isLoopbackHost(host) || dashboardPassword) {
    return;
  }
  throw new Error(
    `Refusing to listen on ${host} without DASHBOARD_PASSWORD. Set one, or keep HOST on 127.0.0.1.`,
  );
}

export function secretPath(db: string): string {
  return join(dirname(db.replace(/^file:/, "")), "watch.secret");
}

function readSecret(path: string): string | null {
  try {
    return readFileSync(path, "utf8").trim() || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function writeSecret(path: string): string {
  const secret = randomBytes(32).toString("base64url");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, secret + "\n", { mode: 0o600, flag: "wx" });
  return secret;
}
