import { randomUUID } from "node:crypto";
import {
  asScanId,
  asSiteId,
  displayRollup,
  parseOrigin,
  parsePluginRef,
  rollupOf,
  scanSummary,
  type ConnectInput,
  type InstalledPlugin,
  type OverviewRow,
  type ScanId,
  type ScanSnapshot,
  type Site,
  type SiteId,
  type SitePage,
  type UpdateInput,
} from "./domain.js";
import { sendAlerts, type AlertConfig } from "./alert.js";
import { assertConnect, createOrgCache, defaultDeps, runScan, setPluginStatus, type OrgCache, type ScanDeps } from "./scan.js";
import { Store, type StoredSite } from "./store.js";

export type Defer = (work: Promise<unknown>) => void;

export class Fleet {
  #store: Store;
  #deps: ScanDeps;
  #alerts: AlertConfig;

  constructor(store: Store, deps: ScanDeps = defaultDeps, alerts: AlertConfig = { channels: [] }) {
    this.#store = store;
    this.#deps = deps;
    this.#alerts = alerts;
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

  async update(id: SiteId, input: UpdateInput): Promise<Site> {
    const site = await this.#store.getSite(id);
    if (!site) {
      throw new Error("Unknown site");
    }
    const name = input.name !== undefined && input.name.trim() ? input.name.trim() : site.name;
    const username = input.username !== undefined && input.username.trim() ? input.username.trim() : site.username;
    const applicationPassword =
      input.applicationPassword !== undefined && input.applicationPassword.trim()
        ? input.applicationPassword.replace(/\s+/g, "")
        : site.applicationPassword;
    const next = { ...site, name, username, applicationPassword };
    if (username !== site.username || applicationPassword !== site.applicationPassword) {
      await assertConnect(next, this.#deps);
    }
    return this.#store.updateSite(next);
  }

  overview(): Promise<OverviewRow[]> {
    return this.#withFreshJobs(() => this.#store.overview());
  }

  async sitePage(id: SiteId): Promise<SitePage> {
    await this.#reapStale();
    const site = await this.#store.getSite(id);
    if (!site) {
      throw new Error("Unknown site");
    }
    const history = await this.#store.listScans(id);
    const latest = history[0] ?? null;
    const running = await this.#store.getJob(id);
    return {
      site: { id: site.id, name: site.name, origin: site.origin },
      username: site.username,
      latest,
      running,
      rollup: displayRollup({ latest, running }),
      history: history.map(scanSummary),
    };
  }

  loginAllowed(ip: string): Promise<boolean> {
    return this.#store.loginAllowed(ip);
  }

  recordLoginFailure(ip: string): Promise<void> {
    return this.#store.recordLoginFailure(ip);
  }

  clearLoginFailures(ip: string): Promise<void> {
    return this.#store.clearLoginFailures(ip);
  }

  async startScan(id: SiteId, defer: Defer = (work) => void work, orgCache?: OrgCache): Promise<{ id: ScanId }> {
    await this.#reapStale();
    return this.#enqueue(id, defer, orgCache);
  }

  async scanAll(defer: Defer = (work) => void work): Promise<{ started: number }> {
    await this.#reapStale();
    const cache = createOrgCache();
    const rows = await this.#store.overview();
    const started = await Promise.all(rows.map((row) => this.#enqueue(row.site.id, defer, cache)));
    return { started: started.length };
  }

  async #enqueue(id: SiteId, defer: Defer, orgCache?: OrgCache): Promise<{ id: ScanId }> {
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
    defer(this.#run(site, orgCache));
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

  async #run(site: StoredSite, orgCache?: OrgCache): Promise<void> {
    const deps = orgCache ? { ...this.#deps, orgCache } : this.#deps;
    try {
      await this.#record(site, await runScan(site, deps));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "scan failed";
      const now = this.#deps.now().toISOString();
      const findings = [
        { kind: "down" as const, severity: "crit" as const, title: "Scan failed", detail },
      ];
      await this.#record(site, {
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

  async #withFreshJobs<T>(fn: () => Promise<T>): Promise<T> {
    await this.#reapStale();
    return fn();
  }

  async #reapStale(): Promise<void> {
    const stale = await this.#store.listStaleJobs();
    for (const job of stale) {
      const site = await this.#store.getSite(job.siteId);
      if (site) {
        const now = this.#deps.now().toISOString();
        const findings = [
          {
            kind: "down" as const,
            severity: "crit" as const,
            title: "Scan did not finish",
            detail: "The process stopped before this scan wrote a snapshot. Start another scan.",
          },
        ];
        await this.#record(site, {
          id: job.id,
          siteId: site.id,
          startedAt: job.startedAt,
          finishedAt: now,
          rollup: rollupOf(findings),
          coreVersion: null,
          plugins: [],
          findings,
        });
      }
      await this.#store.deleteJob(job.siteId);
    }
  }

  async #record(site: StoredSite, snapshot: ScanSnapshot): Promise<void> {
    const previous = await this.#store.latestScan(site.id);
    await this.#store.insertScan(snapshot);
    await sendAlerts({
      site,
      previous: previous?.findings ?? [],
      current: snapshot.findings,
      config: this.#alerts,
      fetch: this.#deps.fetch,
    });
  }
}
