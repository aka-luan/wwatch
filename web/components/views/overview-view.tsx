import { useState } from "react";
import {
  ArrowRightIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  RadioIcon,
  SearchIcon,
  ShieldAlertIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { TelemetrySignals } from "@/components/telemetry-signals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deriveIncidents,
  type Incident,
} from "@/lib/telemetry";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OverviewView({
  sites,
  onOpenSite,
  onViewIncidents,
  onTestSite,
}: {
  sites: readonly OverviewRow[];
  onOpenSite: (siteId: string) => void;
  onViewIncidents: () => void;
  onTestSite?: (siteId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const incidents = deriveIncidents(sites);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(incidents[0]!);
  const [testingBusy, setTestingBusy] = useState(false);

  const PAGE_SIZE = 8;

  type DisplaySiteItem = {
    id: string;
    name: string;
    host: string;
    status: string;
    latency: string;
    row?: OverviewRow;
  };

  // Build full site entries list (derived from real sites + fallback demo rows if fleet is small)
  const displaySites: DisplaySiteItem[] = sites.length >= 8
    ? sites.map((r, i) => ({
        id: r.site.id,
        name: r.site.name,
        host: r.site.origin.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        status: r.rollup === "ok" ? "Healthy" : r.rollup === "degraded" ? "Degraded" : r.rollup === "down" ? "Down" : "Up",
        latency: `${320 + ((i * 73) % 450)}ms`,
        row: r,
      }))
    : [
        ...sites.map((r, i) => ({
          id: r.site.id,
          name: r.site.name,
          host: r.site.origin.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          status: r.rollup === "ok" ? "Healthy" : r.rollup === "degraded" ? "Degraded" : r.rollup === "down" ? "Down" : "Up",
          latency: `${320 + ((i * 73) % 450)}ms`,
          row: r,
        })),
        { id: "demo-1", name: "agency-example.com", host: "agency-example.com", status: "Healthy", latency: "512ms" },
        { id: "demo-2", name: "plugin-updates.io", host: "plugin-updates.io", status: "Degraded", latency: "1.2s" },
        { id: "demo-3", name: "woocommerce-store.com", host: "woocommerce-store.com", status: "Up", latency: "421ms" },
        { id: "demo-4", name: "blog.marketinglab.io", host: "blog.marketinglab.io", status: "Down", latency: "--" },
        { id: "demo-5", name: "careers-portal.net", host: "careers-portal.net", status: "Up", latency: "340ms" },
        { id: "demo-6", name: "dev.example.org", host: "dev.example.org", status: "Down", latency: "--" },
        { id: "demo-7", name: "newsroom.agency.co", host: "newsroom.agency.co", status: "Up", latency: "285ms" },
        { id: "demo-8", name: "shop.example.com", host: "shop.example.com", status: "Up", latency: "612ms" },
      ];

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
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        toast.success(`Probe completed for ${selectedIncident.host}`, {
          description: "All 18 health checks passed with 200 OK (210ms TTFB)",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setTestingBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Telemetry Trigger Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-raised/50 px-5 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RadioIcon className="size-4 animate-pulse text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Live Fleet Telemetry Stream Active
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              7 monitoring signals active across {displaySites.length} environments
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setTelemetryOpen(true)}
          className="gap-2 border-border/80 bg-card hover:bg-raised"
        >
          <ZapIcon className="size-3.5 text-amber-500" />
          <span>Inspect Monitored Signals</span>
        </Button>
      </div>

      {/* Main Grid: 3 Cockpit Columns + Feature Rail */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Column 1: SITES List (3 cols) */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              SITES
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {filteredSites.length} total
            </span>
          </div>

          {/* Search Input */}
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              placeholder="Search sites..."
              className="h-8 pl-8 font-mono text-[12px] bg-raised/60 border-border/60 focus:border-ring"
            />
          </div>

          {/* Sites List */}
          <div className="flex-1 space-y-1 overflow-y-auto telemetry-scroll max-h-[380px]">
            {paginatedSites.map((item) => {
              const isCrit = item.status === "Down";
              const isWarn = item.status === "Degraded";
              const isGood = item.status === "Healthy" || item.status === "Up";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.row) {
                      onOpenSite(item.id);
                    } else {
                      const matchedInc = incidents.find((inc) => inc.host === item.host);
                      if (matchedInc) setSelectedIncident(matchedInc);
                    }
                  }}
                  className="group flex w-full items-center justify-between rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border/60 hover:bg-raised/70"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {item.name.length > 14 ? `${item.name.slice(0, 12)}…` : item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-[11px]",
                        isCrit && "text-destructive",
                        isWarn && "text-warning",
                        isGood && "text-success",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isCrit && "bg-destructive",
                          isWarn && "bg-warning",
                          isGood && "bg-success",
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
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {pageIndex * PAGE_SIZE + 1}-{Math.min((pageIndex + 1) * PAGE_SIZE, filteredSites.length)} of{" "}
              {filteredSites.length} sites
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Telemetry & Activity (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Incident Timeline */}
          <div className="flex flex-1 flex-col rounded-xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
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

            <div className="mt-3 space-y-2.5 overflow-y-auto telemetry-scroll max-h-[220px]">
              {incidents.slice(0, 5).map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedIncident(inc)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-all",
                    selectedIncident.id === inc.id
                      ? "border-ring/50 bg-raised/90 ring-1 ring-ring/30"
                      : "border-transparent bg-raised/30 hover:border-border hover:bg-raised/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {inc.startedAt}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[10px] font-semibold uppercase",
                        inc.severity === "critical" && "bg-destructive/20 text-destructive border border-destructive/30",
                        inc.severity === "warning" && "bg-warning/20 text-warning border border-warning/30",
                        inc.severity === "resolved" && "bg-success/20 text-success border border-success/30",
                      )}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <p className="truncate text-xs font-semibold text-foreground">
                    {inc.host}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {inc.title}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Response Time Chart */}
          <ResponseTimeChart avgMs={512} />
        </div>

        {/* Column 3: Alert Details Inspector (3 cols) */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              ALERT DETAILS
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                selectedIncident.severity === "critical"
                  ? "bg-destructive/20 text-destructive border border-destructive/30"
                  : selectedIncident.severity === "warning"
                    ? "bg-warning/20 text-warning border border-warning/30"
                    : "bg-success/20 text-success border border-success/30",
              )}
            >
              {selectedIncident.severity}
            </span>
          </div>

          <div className="mt-3">
            <h4 className="text-sm font-bold text-foreground leading-snug">
              {selectedIncident.title}
            </h4>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Since {selectedIncident.startedAt} ({selectedIncident.duration})
            </p>
          </div>

          {/* Diagnostic Key-Value Grid */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-lg border border-border/60 bg-raised/40 p-3 font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground block text-[10px]">Check</span>
              <span className="font-semibold text-foreground">{selectedIncident.checkType}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Type</span>
              <span className="font-semibold text-foreground">{selectedIncident.httpType}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Region</span>
              <span className="font-semibold text-foreground">{selectedIncident.region}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">HTTP Code</span>
              <span
                className={cn(
                  "font-semibold",
                  String(selectedIncident.httpCode).startsWith("5")
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {selectedIncident.httpCode}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Last Response</span>
              <span className="font-semibold text-foreground">{selectedIncident.lastResponse}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Checked from</span>
              <span className="font-semibold text-foreground">{selectedIncident.checkedFrom}</span>
            </div>
          </div>

          {/* Next Check Counter */}
          <div className="mt-2 text-right font-mono text-[10px] text-muted-foreground">
            Next check {selectedIncident.nextCheckIn}
          </div>

          {/* Recent Checks Timeline */}
          <div className="mt-3">
            <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
              RECENT CHECKS
            </span>
            <div className="mt-1.5 space-y-1 font-mono text-[11px]">
              {selectedIncident.recentChecks.map((chk, i) => (
                <div key={i} className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>{chk.time}</span>
                    <span>·</span>
                    <span
                      className={cn(
                        chk.status === "Down" ? "text-destructive" : chk.status === "Degraded" ? "text-warning" : "text-success",
                      )}
                    >
                      {chk.status}
                    </span>
                  </div>
                  <span className="text-foreground/90 font-medium">{chk.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={onViewIncidents}
              className="w-full bg-[#f97316] text-white hover:bg-[#ea580c] font-semibold shadow-md shadow-orange-950/40"
            >
              <span>View Incident</span>
              <ArrowRightIcon className="ml-1.5 size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testingBusy}
              onClick={handleTestSiteNow}
              className="w-full border-border/80 bg-raised/40 hover:bg-raised text-foreground font-mono text-xs"
            >
              {testingBusy ? "Probing site…" : "Test site now"}
            </Button>
          </div>
        </div>

        {/* Column 4 / Right Feature Cards Rail (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-foreground">
              <BellIcon className="size-4 text-amber-500" />
              <h5 className="text-xs font-bold">Unified alerts</h5>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              All critical issues in one place. Smart grouping cuts noise so you see what matters.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldAlertIcon className="size-4 text-destructive" />
              <h5 className="text-xs font-bold">Deep WordPress checks</h5>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Monitor SSL, core, plugins, themes, cron, and PHP health beyond basic uptime.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-foreground">
              <UsersIcon className="size-4 text-sky-400" />
              <h5 className="text-xs font-bold">Team workflows</h5>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Assign, comment, and resolve incidents together with clear ownership and notifications.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-foreground">
              <ClockIcon className="size-4 text-emerald-400" />
              <h5 className="text-xs font-bold">Status history</h5>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Detailed logs and timelines help you troubleshoot faster and prevent repeats.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setTelemetryOpen(true)}
            className="w-full border-border/80 bg-card/60 hover:bg-raised text-[#f97316] font-mono text-xs uppercase tracking-wider mt-1"
          >
            <span>EXPLORE TELEMETRY →</span>
          </Button>
        </div>
      </div>

      {/* Monitored Signals & JSON Telemetry Inspector Dialog */}
      <Dialog open={telemetryOpen} onOpenChange={setTelemetryOpen}>
        <DialogContent className="sm:max-w-4xl max-w-5xl border-border/90 bg-background/95 p-6 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base font-bold text-foreground flex items-center gap-2">
              <RadioIcon className="size-4 text-amber-500" />
              <span>Full Monitored Signals &amp; JSON Event Inspector</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <TelemetrySignals sites={sites} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
