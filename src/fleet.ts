import { randomUUID } from "node:crypto";
import {
  asScanId,
  asSiteId,
  displayRollup,
  parseOrigin,
  parsePluginRef,
  rollupOf,
  type ConnectInput,
  type InstalledPlugin,
  type OverviewRow,
  type ScanId,
  type Site,
  type SiteId,
  type SitePage,
} from "./domain.js";
import { assertConnect, defaultDeps, runScan, setPluginStatus, type ScanDeps } from "./scan.js";
import { Store, type StoredSite } from "./store.js";

export type Defer = (work: Promise<unknown>) => void;

export class Fleet {
  #store: Store;
  #deps: ScanDeps;

  constructor(store: Store, deps: ScanDeps = defaultDeps) {
    this.#store = store;
    this.#deps = deps;
  }

  async connect(input: ConnectInput): Promise<Site> {
    const origin = parseOrigin(input.origin);
    const existing = await this.#store.findByOrigin(origin);
    if (existing) {
      throw new Error(`Already connected: ${origin}`);
    }
    const name = input.name.trim() || origin.replace(/^https?:\/\//, "");
    if (!input.username.trim() || !input.applicationPassword.trim()) {
      throw new Error("Username and application password are required");
    }
    const site = {
      id: asSiteId(randomUUID()),
      name,
      origin,
      username: input.username.trim(),
      applicationPassword: input.applicationPassword.replace(/\s+/g, ""),
    };
    await assertConnect(site, this.#deps);
    return this.#store.insertSite(site);
  }

  async disconnect(id: SiteId): Promise<void> {
    await this.#store.deleteSite(id);
  }

  overview(): Promise<OverviewRow[]> {
    return this.#store.overview();
  }

  async sitePage(id: SiteId): Promise<SitePage> {
    const site = await this.#store.getSite(id);
    if (!site) {
      throw new Error("Unknown site");
    }
    const latest = await this.#store.latestScan(id);
    const running = await this.#store.getJob(id);
    return {
      site: { id: site.id, name: site.name, origin: site.origin },
      latest,
      running,
      rollup: displayRollup({ latest, running }),
    };
  }

  async startScan(id: SiteId, defer: Defer = (work) => void work): Promise<{ id: ScanId }> {
    const current = await this.#store.getJob(id);
    if (current) {
      return { id: current.id };
    }
    const site = await this.#store.getSite(id);
    if (!site) {
      throw new Error("Unknown site");
    }
    const job = { id: asScanId(randomUUID()), startedAt: new Date().toISOString() };
    await this.#store.putJob(id, job);
    defer(this.#run(site));
    return { id: job.id };
  }

  async setPluginStatus(input: {
    siteId: SiteId;
    plugin: string;
    status: InstalledPlugin["status"];
  }): Promise<InstalledPlugin> {
    const site = await this.#store.getSite(input.siteId);
    if (!site) {
      throw new Error("Unknown site");
    }
    return setPluginStatus(site, parsePluginRef(input.plugin), input.status, this.#deps);
  }

  async #run(site: StoredSite): Promise<void> {
    try {
      const snapshot = await runScan(site, this.#deps);
      await this.#store.insertScan(snapshot);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "scan failed";
      const now = this.#deps.now().toISOString();
      const findings = [
        { kind: "down" as const, severity: "crit" as const, title: "Scan failed", detail },
      ];
      await this.#store.insertScan({
        id: asScanId(randomUUID()),
        siteId: site.id,
        startedAt: now,
        finishedAt: now,
        rollup: rollupOf(findings),
        coreVersion: null,
        plugins: [],
        findings,
      });
    } finally {
      await this.#store.deleteJob(site.id);
    }
  }
}
