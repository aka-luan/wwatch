import type { HelperInfo } from "./helper";

export type { HelperInfo };

export type Site = {
  id: string;
  name: string;
  origin: string;
};

export type InstalledPlugin = {
  ref: string;
  slug: string;
  name: string;
  version: string;
  status: "active" | "inactive";
};

export type Finding = {
  kind: string;
  severity: "info" | "warn" | "crit";
  title: string;
  detail: string;
  plugin?: string;
  theme?: string;
  latest?: string;
  installed?: string;
  path?: string;
  url?: string;
  httpStatus?: number | null;
  daysLeft?: number;
};

export type ScanSnapshot = {
  id: string;
  siteId: string;
  startedAt: string;
  finishedAt: string;
  rollup: "ok" | "degraded" | "down" | "auth_failed";
  coreVersion: string | null;
  plugins: InstalledPlugin[];
  findings: Finding[];
  helper: HelperInfo | null;
};

export type OverviewRow = {
  site: Site;
  latest: ScanSnapshot | null;
  running: { id: string; startedAt: string } | null;
  rollup: "never" | "running" | "ok" | "degraded" | "down" | "auth_failed";
};

export type ScanSummary = {
  id: string;
  finishedAt: string;
  rollup: "ok" | "degraded" | "down" | "auth_failed";
  counts: { crit: number; warn: number; info: number; updates: number };
};

export type SitePage = OverviewRow & {
  username: string;
  history: ScanSummary[];
};
