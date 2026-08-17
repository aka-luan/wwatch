import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient as createWebClient, type Client, type InValue } from "@libsql/client/web";
import {
  asScanId,
  asSiteId,
  displayRollup,
  parseHelperInfo,
  type Finding,
  type InstalledPlugin,
  type Origin,
  type OverviewRow,
  type ScanId,
  type ScanSnapshot,
  type Site,
  type SiteId,
} from "./domain.js";
import { isCurrentWrap, unwrapPassword, wrapPassword, wrapSecretsFromEnv } from "./wrap.js";

export type StoredSite = Site & {
  username: string;
  applicationPassword: string;
};

export type StoreConfig = {
  url: string;
  authToken?: string;
  /** Secret new rows are sealed with. */
  wrapSecret?: string;
  /** Older secrets that may still unseal rows written before the current one. */
  previousWrapSecrets?: string[];
};

const STALE_JOB_MS = 3 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 10;
const HISTORY_LIMIT = 10;

export function storeConfigFromEnv(): StoreConfig {
  const [wrapSecret, ...previousWrapSecrets] = wrapSecretsFromEnv();
  if (process.env.TURSO_DATABASE_URL) {
    return {
      url: process.env.TURSO_DATABASE_URL,
      ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
      ...(wrapSecret ? { wrapSecret } : {}),
      ...(previousWrapSecrets.length ? { previousWrapSecrets } : {}),
    };
  }
  const path = process.env.WATCH_DB ?? "data/watch.db";
  return {
    url: path.startsWith("file:") ? path : `file:${path}`,
    ...(wrapSecret ? { wrapSecret } : {}),
    ...(previousWrapSecrets.length ? { previousWrapSecrets } : {}),
  };
}

export class Store {
  #db!: Client;
  #ready: Promise<void>;
  #secret: string | null;
  #secrets: string[];

  constructor(config: StoreConfig | string) {
    const resolved = typeof config === "string" ? { url: fileUrl(config) } : config;
    this.#secret = resolved.wrapSecret ?? null;
    this.#secrets = [resolved.wrapSecret, ...(resolved.previousWrapSecrets ?? [])].filter(
      (secret): secret is string => !!secret,
    );
    if (resolved.url.startsWith("file:")) {
      const path = resolved.url.slice("file:".length);
      mkdirSync(dirname(path), { recursive: true });
    }
    this.#ready = this.#init(resolved);
    this.#ready.catch(() => undefined);
  }

  async insertSite(site: StoredSite): Promise<Site> {
    await this.#ready;
    await this.#db.execute({
      sql: `INSERT INTO sites (id, name, origin, username, application_password)
            VALUES (?, ?, ?, ?, ?)`,
      args: [site.id, site.name, site.origin, site.username, this.#seal(site.applicationPassword)],
    });
    return publicSite(site);
  }

  async updateSite(site: StoredSite): Promise<Site> {
    await this.#ready;
    await this.#db.execute({
      sql: `UPDATE sites
            SET name = ?, username = ?, application_password = ?
            WHERE id = ?`,
      args: [site.name, site.username, this.#seal(site.applicationPassword), site.id],
    });
    return publicSite(site);
  }

  async getSite(id: SiteId): Promise<StoredSite | null> {
    await this.#ready;
    const row = await this.#one(
      `SELECT * FROM sites WHERE id = ?`,
      [id],
    );
    return row ? this.#fromSiteRow(row) : null;
  }

  async findByOrigin(origin: Origin): Promise<StoredSite | null> {
    await this.#ready;
    const row = await this.#one(`SELECT * FROM sites WHERE origin = ?`, [origin]);
    return row ? this.#fromSiteRow(row) : null;
  }

  async deleteSite(id: SiteId): Promise<void> {
    await this.#ready;
    await this.#db.execute({ sql: `DELETE FROM jobs WHERE site_id = ?`, args: [id] });
    await this.#db.execute({ sql: `DELETE FROM scans WHERE site_id = ?`, args: [id] });
    await this.#db.execute({ sql: `DELETE FROM sites WHERE id = ?`, args: [id] });
  }

  async listSites(): Promise<StoredSite[]> {
    await this.#ready;
    const result = await this.#db.execute(
      `SELECT * FROM sites ORDER BY name COLLATE NOCASE`,
    );
    return result.rows.map((row) => this.#fromSiteRow(asRecord(row)));
  }

  async insertScan(snapshot: ScanSnapshot): Promise<void> {
    await this.#ready;
    await this.#db.execute({
      sql: `INSERT INTO scans
              (id, site_id, started_at, finished_at, rollup, core_version, plugins_json, findings_json, helper_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        snapshot.id,
        snapshot.siteId,
        snapshot.startedAt,
        snapshot.finishedAt,
        snapshot.rollup,
        snapshot.coreVersion,
        JSON.stringify(snapshot.plugins),
        JSON.stringify(snapshot.findings),
        snapshot.helper ? JSON.stringify(snapshot.helper) : null,
      ],
    });
  }

  async latestScan(siteId: SiteId): Promise<ScanSnapshot | null> {
    const scans = await this.listScans(siteId, 1);
    return scans[0] ?? null;
  }

  async listScans(siteId: SiteId, limit = HISTORY_LIMIT): Promise<ScanSnapshot[]> {
    await this.#ready;
    const result = await this.#db.execute({
      sql: `SELECT * FROM scans WHERE site_id = ? ORDER BY finished_at DESC, rowid DESC LIMIT ?`,
      args: [siteId, limit],
    });
    return result.rows.map((row) => fromScanRow(asRecord(row)));
  }

  async putJob(siteId: SiteId, job: { id: ScanId; startedAt: string }): Promise<void> {
    await this.#ready;
    await this.#db.execute({
      sql: `INSERT INTO jobs (site_id, id, started_at) VALUES (?, ?, ?)
            ON CONFLICT(site_id) DO UPDATE SET id = excluded.id, started_at = excluded.started_at`,
      args: [siteId, job.id, job.startedAt],
    });
  }

  async getJob(siteId: SiteId): Promise<{ id: ScanId; startedAt: string } | null> {
    await this.#ready;
    const row = await this.#one(`SELECT id, started_at FROM jobs WHERE site_id = ?`, [siteId]);
    return row ? freshJob(row) : null;
  }

  async deleteJob(siteId: SiteId): Promise<void> {
    await this.#ready;
    await this.#db.execute({ sql: `DELETE FROM jobs WHERE site_id = ?`, args: [siteId] });
  }

  async loginAllowed(ip: string): Promise<boolean> {
    await this.#ready;
    const row = await this.#one(`SELECT count, reset_at FROM login_failures WHERE ip = ?`, [ip]);
    if (!row) {
      return true;
    }
    if (Date.now() > int(row, "reset_at")) {
      return true;
    }
    return int(row, "count") < LOGIN_MAX_FAILURES;
  }

  async recordLoginFailure(ip: string): Promise<void> {
    await this.#ready;
    const now = Date.now();
    const row = await this.#one(`SELECT count, reset_at FROM login_failures WHERE ip = ?`, [ip]);
    if (!row || now > int(row, "reset_at")) {
      await this.#db.execute({
        sql: `INSERT INTO login_failures (ip, count, reset_at) VALUES (?, 1, ?)
              ON CONFLICT(ip) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
        args: [ip, now + LOGIN_WINDOW_MS],
      });
      return;
    }
    await this.#db.execute({
      sql: `UPDATE login_failures SET count = count + 1 WHERE ip = ?`,
      args: [ip],
    });
  }

  async clearLoginFailures(ip: string): Promise<void> {
    await this.#ready;
    await this.#db.execute({ sql: `DELETE FROM login_failures WHERE ip = ?`, args: [ip] });
  }

  async overview(): Promise<OverviewRow[]> {
    const sites = await this.listSites();
    const rows: OverviewRow[] = [];
    for (const site of sites) {
      const latest = await this.latestScan(site.id);
      const running = await this.getJob(site.id);
      rows.push({
        site: publicSite(site),
        latest,
        running,
        rollup: displayRollup({ latest, running }),
      });
    }
    return rows;
  }

  async close(): Promise<void> {
    await this.#ready.catch(() => undefined);
    this.#db?.close();
  }

  async #init(config: StoreConfig): Promise<void> {
    this.#db = await openClient(config);
    await this.#db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        origin TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        application_password TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        rollup TEXT NOT NULL,
        core_version TEXT,
        plugins_json TEXT NOT NULL,
        findings_json TEXT NOT NULL,
        helper_json TEXT
      );
      CREATE TABLE IF NOT EXISTS jobs (
        site_id TEXT PRIMARY KEY,
        id TEXT NOT NULL,
        started_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS login_failures (
        ip TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scans_site_finished ON scans (site_id, finished_at DESC);
    `);
    await this.#ensureHelperColumn();
    await this.#wrapExistingPasswords();
    if (config.url.startsWith("file:")) {
      try {
        chmodSync(config.url.slice("file:".length), 0o600);
      } catch {
        return;
      }
    }
  }

  async #one(sql: string, args: InValue[]): Promise<Record<string, unknown> | null> {
    const result = await this.#db.execute({ sql, args });
    const row = result.rows[0];
    return row ? asRecord(row) : null;
  }

  #seal(plain: string): string {
    return this.#secret ? wrapPassword(plain, this.#secret) : plain;
  }

  #fromSiteRow(row: Record<string, unknown>): StoredSite {
    return {
      id: asSiteId(text(row, "id")),
      name: text(row, "name"),
      origin: text(row, "origin") as Origin,
      username: text(row, "username"),
      applicationPassword: unwrapPassword(text(row, "application_password"), this.#secrets),
    };
  }

  async #ensureHelperColumn(): Promise<void> {
    try {
      await this.#db.execute(`ALTER TABLE scans ADD COLUMN helper_json TEXT`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column/i.test(message)) {
        throw error;
      }
    }
  }

  /**
   * Brings every row up to the current wrapping: plaintext rows, v1 rows, and rows sealed under a
   * secret that has since been rotated all get resealed under the secret in use now.
   */
  async #wrapExistingPasswords(): Promise<void> {
    const secret = this.#secret;
    if (!secret) {
      return;
    }
    const result = await this.#db.execute(`SELECT id, application_password FROM sites`);
    for (const row of result.rows) {
      const rec = asRecord(row);
      const stored = text(rec, "application_password");
      if (isCurrentWrap(stored, secret)) {
        continue;
      }
      const plain = unwrapPassword(stored, this.#secrets);
      await this.#db.execute({
        sql: `UPDATE sites SET application_password = ? WHERE id = ?`,
        args: [wrapPassword(plain, secret), text(rec, "id")],
      });
    }
  }
}

function fileUrl(path: string): string {
  return path.startsWith("file:") ? path : `file:${path}`;
}

function clientConfig(config: StoreConfig) {
  return {
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  };
}

async function openClient(config: StoreConfig): Promise<Client> {
  if (config.url.startsWith("file:")) {
    const { createClient } = await import("@libsql/client");
    return createClient(clientConfig(config));
  }
  return createWebClient(clientConfig(config));
}

function publicSite(site: StoredSite): Site {
  return { id: site.id, name: site.name, origin: site.origin };
}

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`expected ${key} to be a string`);
  }
  return value;
}

function int(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new Error(`expected ${key} to be a number`);
}

function fromScanRow(row: Record<string, unknown>): ScanSnapshot {
  const core = row.core_version;
  return {
    id: asScanId(text(row, "id")),
    siteId: asSiteId(text(row, "site_id")),
    startedAt: text(row, "started_at"),
    finishedAt: text(row, "finished_at"),
    rollup: text(row, "rollup") as ScanSnapshot["rollup"],
    coreVersion: typeof core === "string" ? core : null,
    plugins: JSON.parse(text(row, "plugins_json")) as InstalledPlugin[],
    findings: JSON.parse(text(row, "findings_json")) as Finding[],
    helper: parseHelperJson(row.helper_json),
  };
}

function parseHelperJson(raw: unknown): ScanSnapshot["helper"] {
  if (typeof raw !== "string" || !raw) {
    return null;
  }
  try {
    return parseHelperInfo(JSON.parse(raw));
  } catch {
    return null;
  }
}

function freshJob(row: Record<string, unknown>): { id: ScanId; startedAt: string } | null {
  const startedAt = text(row, "started_at");
  if (Date.now() - Date.parse(startedAt) > STALE_JOB_MS) {
    return null;
  }
  return { id: asScanId(text(row, "id")), startedAt };
}
