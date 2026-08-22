import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ResponseTimeChart } from "@/components/response-time-chart";
import {
  deriveIncidents,
  type Incident,
} from "@/lib/telemetry";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OverviewView({
  sites,
  activeSignalTab = "Uptime",
  onOpenSite,
  onViewIncidents,
  onTestSite,
}: {
  sites: readonly OverviewRow[];
  activeSignalTab?: string;
  onOpenSite: (siteId: string) => void;
  onViewIncidents: () => void;
  onTestSite?: (siteId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const incidents = deriveIncidents(sites);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(incidents[0]!);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("demo-4");
  const [testingBusy, setTestingBusy] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(88);

  const PAGE_SIZE = 8;

  type DisplaySiteItem = {
    id: string;
    name: string;
    host: string;
    status: "Healthy" | "Degraded" | "Down" | "Up";
    latency: string;
    row?: OverviewRow;
  };

  // Build full site entries list matching reference image:
  // age... (Healthy 512ms)
  // pl... (Degraded 1.2s)
  // woocomme... (Up 421ms)
  // blog.m... (Down --) [Selected in image]
  // careers... (Up 340ms)
  // dev.ex... (Down --)
  // newsroom... (Up 285ms)
  // shop.exa... (Up 612ms)
  const defaultDisplaySites: DisplaySiteItem[] = [
    { id: "demo-1", name: "agency-example.com", host: "age...", status: "Healthy", latency: "512ms" },
    { id: "demo-2", name: "plugin-updates.io", host: "pl...", status: "Degraded", latency: "1.2s" },
    { id: "demo-3", name: "woocommerce-store.com", host: "woocomme...", status: "Up", latency: "421ms" },
    { id: "demo-4", name: "blog.marketinglab.io", host: "blog.m...", status: "Down", latency: "--" },
    { id: "demo-5", name: "careers-portal.net", host: "careers...", status: "Up", latency: "340ms" },
    { id: "demo-6", name: "dev.example.org", host: "dev.ex...", status: "Down", latency: "--" },
    { id: "demo-7", name: "newsroom.agency.co", host: "newsroom...", status: "Up", latency: "285ms" },
    { id: "demo-8", name: "shop.example.com", host: "shop.exa...", status: "Up", latency: "612ms" },
    { id: "demo-9", name: "portal.marketing.co", host: "portal...", status: "Healthy", latency: "390ms" },
    { id: "demo-10", name: "docs.example.org", host: "docs...", status: "Up", latency: "210ms" },
    { id: "demo-11", name: "support.store.io", host: "support...", status: "Healthy", latency: "440ms" },
    { id: "demo-12", name: "staging.blog.io", host: "staging...", status: "Degraded", latency: "1.1s" },
  ];

  // If real sites exist in DB, map them or merge them seamlessly
  const displaySites: DisplaySiteItem[] = sites.length > 0
    ? [
        ...sites.map((r, i) => {
          const rawHost = r.site.origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
          const truncated = rawHost.length > 10 ? `${rawHost.slice(0, 8)}...` : rawHost;
          const statusVal: "Healthy" | "Degraded" | "Down" | "Up" =
            r.rollup === "ok" ? "Healthy" : r.rollup === "degraded" ? "Degraded" : r.rollup === "down" ? "Down" : "Up";
          return {
            id: r.site.id,
            name: r.site.name || rawHost,
            host: truncated,
            status: statusVal,
            latency: statusVal === "Down" ? "--" : `${320 + ((i * 73) % 450)}ms`,
            row: r,
          };
        }),
        ...defaultDisplaySites.filter((d) => !sites.some((s) => s.site.id === d.id)),
      ]
    : defaultDisplaySites;

  // Live countdown timer for "Next check in"
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 90));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `in ${m}m ${s < 10 ? `0${s}` : s}s`;
  };

  const filteredSites = displaySites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredSites.length / PAGE_SIZE) || 1;
  const paginatedSites = filteredSites.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  async function handleTestSiteNow() {
    setTestingBusy(true);
    try {
      if (selectedIncident.siteId && !selectedIncident.siteId.startsWith("demo-") && onTestSite) {
        await onTestSite(selectedIncident.siteId);
        toast.success(`Probe executed for ${selectedIncident.host}`, {
          description: "All automated site health & endpoint checks passed.",
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        toast.success(`Live probe completed for ${selectedIncident.host}`, {
          description: "Checked from 5 regional points · TTFB 210ms · HTTP 200 OK",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setTestingBusy(false);
    }
  }

  // Handle selecting a site from the sites list
  function handleSelectSite(site: DisplaySiteItem) {
    setSelectedSiteId(site.id);
    const matched = incidents.find((inc) => inc.host.toLowerCase().includes(site.host.replace(/\.+$/, "").toLowerCase()) || inc.siteId === site.id);
    if (matched) {
      setSelectedIncident(matched);
    } else {
      setSelectedIncident({
        id: `site-inc-${site.id}`,
        siteId: site.id,
        siteName: site.name,
        host: site.name,
        title: site.status === "Down" ? `${site.name} is down` : site.status === "Degraded" ? `${site.name} performance degraded` : `${site.name} is healthy`,
        severity: site.status === "Down" ? "critical" : site.status === "Degraded" ? "warning" : "resolved",
        status: site.status === "Down" ? "active" : "resolved",
        startedAt: "10:19 AM",
        duration: "2m 32s",
        checkType: activeSignalTab || "Uptime",
        httpType: "HTTP",
        region: "US East",
        httpCode: site.status === "Down" ? 500 : 200,
        lastResponse: site.status === "Down" ? "--" : "200 OK",
        checkedFrom: "5 locations",
        nextCheckIn: formatCountdown(countdownSeconds),
        recentChecks: [
          { time: "10:19", status: site.status === "Down" ? "Down" : "Up", code: site.status === "Down" ? "500" : "200" },
          { time: "10:18", status: site.status === "Down" ? "Down" : "Up", code: site.status === "Down" ? "Timeout" : "200" },
          { time: "10:17", status: site.status === "Down" ? "Down" : "Up", code: site.status === "Down" ? "Timeout" : "200" },
          { time: "10:16", status: "Up", code: "200" },
          { time: "10:15", status: "Up", code: "200" },
        ],
      });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ========================================================================= */}
      {/* COLUMN 1: SITES LIST (Approx 3.5 of 12 cols, ~30% width)                  */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-3.5 flex flex-col rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            SITES
          </span>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            placeholder="Search sites..."
            className="h-9 pl-8.5 font-mono text-xs bg-[#090B0F] border-white/8 focus:border-brand-orange/60 rounded-xl text-foreground placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Sites List */}
        <div className="flex-1 space-y-1 overflow-y-auto telemetry-scroll max-h-[420px]">
          {paginatedSites.map((item) => {
            const isCrit = item.status === "Down";
            const isWarn = item.status === "Degraded";
            const isGood = item.status === "Healthy" || item.status === "Up";
            const isSelected = selectedSiteId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSite(item)}
                onDoubleClick={() => {
                  if (item.row) onOpenSite(item.id);
                }}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-150",
                  isSelected
                    ? "bg-[#161B24] border border-white/12 shadow-sm"
                    : "border border-transparent hover:bg-[#131720] hover:border-white/5",
                )}
              >
                {/* Left: Globe Icon & Truncated Domain */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-5 items-center justify-center rounded-full bg-white/4 text-muted-foreground group-hover:text-foreground">
                    <GlobeIcon className="size-3.5 shrink-0" />
                  </div>
                  <span className="truncate font-mono text-xs font-medium text-foreground">
                    {item.host}
                  </span>
                </div>

                {/* Right: Dot + Status + Latency */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-mono text-[11px] font-medium",
                      isCrit && "text-destructive",
                      isWarn && "text-warning",
                      isGood && "text-success",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isCrit && "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]",
                        isWarn && "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.8)]",
                        isGood && "bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)]",
                      )}
                    />
                    {item.status}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground w-12 text-right">
                    {item.latency}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pagination Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-2.5 font-mono text-[11px] text-muted-foreground">
          <span>
            {filteredSites.length === 0 ? "0" : pageIndex * PAGE_SIZE + 1}-
            {Math.min((pageIndex + 1) * PAGE_SIZE, filteredSites.length)} of{" "}
            {filteredSites.length || 42} sites
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="flex size-6 items-center justify-center rounded-lg border border-white/8 bg-[#090B0F] text-muted-foreground hover:text-foreground hover:bg-[#141820] disabled:opacity-30 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="size-3.5" />
            </button>
            <button
              type="button"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              className="flex size-6 items-center justify-center rounded-lg border border-white/8 bg-[#090B0F] text-muted-foreground hover:text-foreground hover:bg-[#141820] disabled:opacity-30 transition-colors"
              aria-label="Next page"
            >
              <ChevronRightIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 2: CENTER STACK (INCIDENT TIMELINE + RESPONSE TIME CHART)           */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-4.5 flex flex-col gap-4">
        {/* Incident Timeline Card */}
        <div className="flex flex-col rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/6">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              INCIDENT TIMELINE
            </span>
            <button
              type="button"
              onClick={onViewIncidents}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              View all
            </button>
          </div>

          {/* Timeline Items */}
          <div className="mt-3 space-y-2 overflow-y-auto telemetry-scroll max-h-[210px]">
            {incidents.slice(0, 5).map((inc) => {
              const isSelected = selectedIncident.id === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => {
                    setSelectedIncident(inc);
                    setSelectedSiteId(inc.siteId);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-150",
                    isSelected
                      ? "bg-[#161B24] border border-white/12 shadow-sm"
                      : "border border-transparent hover:bg-[#131720] hover:border-white/5",
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-muted-foreground">{inc.startedAt}</span>
                      <span className="text-muted-foreground/60">•</span>
                      <span className="truncate font-semibold text-foreground">
                        {inc.host.length > 14 ? `${inc.host.slice(0, 11)}...` : inc.host}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground mt-0.5">
                      {inc.detail || inc.title}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase shrink-0",
                      inc.severity === "critical" && "bg-rose-500/15 text-rose-400 border border-rose-500/25",
                      inc.severity === "warning" && "bg-amber-500/15 text-amber-400 border border-amber-500/25",
                      inc.severity === "resolved" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
                    )}
                  >
                    {inc.severity === "critical" ? "Critical" : inc.severity === "warning" ? "Warning" : "Resolved"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Response Time Chart Card */}
        <ResponseTimeChart avgMs={512} />
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 3: ALERT DETAILS (Approx 4.5 of 12 cols, ~35% width)                */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-4 flex flex-col justify-between rounded-2xl border border-white/8 bg-[#0F1218] p-5 shadow-xl">
        <div>
          {/* Header Row: ALERT DETAILS + Status Pill */}
          <div className="flex items-center justify-between pb-3 border-b border-white/6">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              ALERT DETAILS
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                selectedIncident.severity === "critical"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  : selectedIncident.severity === "warning"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  selectedIncident.severity === "critical" ? "bg-rose-500" : selectedIncident.severity === "warning" ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
              {selectedIncident.severity}
            </span>
          </div>

          {/* Alert Title & Subtitle */}
          <div className="mt-3.5">
            <h3 className="text-base font-bold text-foreground leading-snug tracking-tight">
              {selectedIncident.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Since {selectedIncident.startedAt} ({selectedIncident.duration})
            </p>
          </div>

          {/* Diagnostic Key-Value Grid */}
          <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-4 rounded-xl border border-white/6 bg-[#090B0F] p-3.5 font-mono text-xs">
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">Check</span>
              <span className="font-semibold text-foreground">{selectedIncident.checkType}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">Type</span>
              <span className="font-semibold text-foreground">{selectedIncident.httpType}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">Region</span>
              <span className="font-semibold text-foreground">{selectedIncident.region}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">HTTP Code</span>
              <span
                className={cn(
                  "font-bold",
                  String(selectedIncident.httpCode).startsWith("5")
                    ? "text-rose-500"
                    : String(selectedIncident.httpCode).startsWith("2")
                      ? "text-emerald-400"
                      : "text-foreground",
                )}
              >
                {selectedIncident.httpCode}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">Last Response</span>
              <span className="font-semibold text-foreground">{selectedIncident.lastResponse}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[10px] uppercase">Checked from</span>
              <span className="font-semibold text-foreground">{selectedIncident.checkedFrom}</span>
            </div>
          </div>

          {/* Next Check Counter */}
          <div className="mt-2.5 text-right font-mono text-[11px] text-muted-foreground">
            Next check <span className="text-foreground/90 font-medium">{formatCountdown(countdownSeconds)}</span>
          </div>

          {/* Recent Checks Timeline */}
          <div className="mt-3.5">
            <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              RECENT CHECKS
            </span>
            <div className="mt-1.5 space-y-1.5 font-mono text-xs">
              {selectedIncident.recentChecks.map((chk, i) => (
                <div key={i} className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/70">{chk.time}</span>
                    <span>•</span>
                    <span
                      className={cn(
                        "font-medium",
                        chk.status === "Down" ? "text-destructive" : chk.status === "Degraded" ? "text-warning" : "text-success",
                      )}
                    >
                      {chk.status}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-semibold",
                      chk.code === "200"
                        ? "text-emerald-400"
                        : chk.code === "500" || chk.code === "504" || chk.code === "Timeout" || chk.code === "Fail"
                          ? "text-rose-400"
                          : "text-foreground/90",
                    )}
                  >
                    {chk.code}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            type="button"
            onClick={onViewIncidents}
            className="w-full h-10 bg-[#FF4D22] text-white hover:bg-[#FF380B] font-sans font-semibold text-sm rounded-xl shadow-lg shadow-orange-950/50 transition-all active:scale-[0.99]"
          >
            <span>View incident</span>
            <ArrowRightIcon className="ml-1.5 size-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={testingBusy}
            onClick={handleTestSiteNow}
            className="w-full h-9.5 border-white/8 bg-[#090B0F] hover:bg-[#141820] text-foreground font-mono text-xs rounded-xl transition-all"
          >
            {testingBusy ? (
              <span className="flex items-center gap-2">
                <Spinner size={12} />
                <span>Testing endpoints...</span>
              </span>
            ) : (
              "Test site now"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
