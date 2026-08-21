import { useState } from "react";
import {
  ArrowRightIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  Maximize2Icon,
  PuzzleIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TerminalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { cn } from "@/lib/utils";

export function HeroProductVisual() {
  const [activeTab, setActiveTab] = useState<"signals" | "cockpit">("signals");
  const [selectedSignal, setSelectedSignal] = useState<string>("updates");
  const [isScanning, setIsScanning] = useState(false);

  const signals = [
    { id: "uptime", title: "Uptime", subtitle: "5 min interval", status: "healthy", icon: GlobeIcon },
    { id: "ssl", title: "SSL Expiry", subtitle: "30 days threshold", status: "warning", icon: LockIcon },
    { id: "updates", title: "Plugin Updates", subtitle: "Auto-detected", status: "critical", icon: PuzzleIcon },
    { id: "backups", title: "Backup Status", subtitle: "Daily verification", status: "healthy", icon: ShieldCheckIcon },
    { id: "performance", title: "PHP & Performance", subtitle: "Health score", status: "warning", icon: ClockIcon },
    { id: "cron", title: "Cron & Jobs", subtitle: "Execution checks", status: "critical", icon: TerminalIcon },
    { id: "incidents", title: "Incidents", subtitle: "Anomaly detection", status: "healthy", icon: ShieldAlertIcon },
  ];

  const eventPayload = {
    site: "agency-example.com",
    event:
      selectedSignal === "updates"
        ? "plugin_update_available"
        : selectedSignal === "ssl"
          ? "ssl_expiry_warning"
          : selectedSignal === "cron"
            ? "cron_execution_failure"
            : "uptime_check_passed",
    plugin: selectedSignal === "updates" ? "woocommerce" : undefined,
    current: selectedSignal === "updates" ? "8.6.1" : undefined,
    latest: selectedSignal === "updates" ? "8.7.0" : undefined,
    severity: selectedSignal === "updates" || selectedSignal === "cron" ? "critical" : selectedSignal === "ssl" ? "warning" : "healthy",
    detected_at: "2026-08-20T10:24:31Z",
    url: "https://agency-example.com/wp-admin/",
    php_version: "8.1.22",
    environment: "production",
  };

  const activities = [
    { text: "Uptime check passed", time: "10:24:31", tone: "healthy" },
    { text: "SSL expires in 28 days", time: "10:23:12", tone: "warning" },
    { text: "Plugin update available: WooCommerce", time: "10:22:47", tone: "critical" },
    { text: "Backup verification successful", time: "10:21:09", tone: "healthy" },
    { text: "Cron job failed: wp_scheduled_event", time: "10:20:33", tone: "critical" },
    { text: "Performance score: 92/100", time: "10:19:58", tone: "healthy" },
  ];

  function runSimulatedScan() {
    if (isScanning) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  }

  return (
    <div className="relative rounded-2xl border border-border/80 bg-card/90 shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden">
      {/* Top Window Bar with Interactive Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-raised/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-red-500/80" />
          <div className="size-3 rounded-full bg-yellow-500/80" />
          <div className="size-3 rounded-full bg-green-500/80" />
          <span className="ml-2 font-mono text-[11px] text-muted-foreground hidden sm:inline">
            wwatch-telemetry-cockpit.local
          </span>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("signals")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              activeTab === "signals"
                ? "bg-raised text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Signals &amp; JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cockpit")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              activeTab === "cockpit"
                ? "bg-raised text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Dashboard Cockpit
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isScanning}
          onClick={runSimulatedScan}
          className="h-7 text-xs font-mono gap-1.5 border-border/80 bg-card hover:bg-raised"
        >
          <RefreshCwIcon className={cn("size-3", isScanning && "animate-spin text-[#f97316]")} />
          <span>{isScanning ? "Probing…" : "Live Probe"}</span>
        </Button>
      </div>

      {/* Main Container View */}
      <div className="p-4 sm:p-5">
        {activeTab === "signals" ? (
          /* Mockup 1: Monitored Signals + Event Details JSON & Activity */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Monitored Signals */}
            <div className="lg:col-span-5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  MONITORED SIGNALS
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">7 ACTIVE</span>
              </div>

              <div className="space-y-1.5">
                {signals.map((sig) => {
                  const Icon = sig.icon;
                  const isSelected = selectedSignal === sig.id;
                  return (
                    <button
                      key={sig.id}
                      type="button"
                      onClick={() => setSelectedSignal(sig.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-150",
                        isSelected
                          ? "border-ring/40 bg-raised ring-1 ring-ring/30 shadow-md"
                          : "border-border/60 bg-raised/30 hover:border-border hover:bg-raised/70",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                            isSelected
                              ? "border-ring/40 bg-ring/10 text-foreground"
                              : "border-border/50 bg-card text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {sig.title}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {sig.subtitle}
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium border",
                          sig.status === "healthy" && "border-success/30 bg-success/10 text-success",
                          sig.status === "warning" && "border-warning/30 bg-warning/10 text-warning",
                          sig.status === "critical" && "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            sig.status === "healthy" && "bg-success",
                            sig.status === "warning" && "bg-warning",
                            sig.status === "critical" && "bg-destructive",
                          )}
                        />
                        {sig.status === "healthy" ? "Healthy" : sig.status === "warning" ? "Warning" : "Critical"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Event Details JSON & Recent Activity */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Event Details Card */}
              <div className="rounded-xl border border-border/80 bg-card/90 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/70 bg-raised/40 px-3.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-destructive" />
                    <span className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
                      EVENT DETAILS
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <span>2m ago</span>
                    <Maximize2Icon className="size-3" />
                  </div>
                </div>

                <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto telemetry-scroll max-h-[165px]">
                  <pre className="text-foreground/90 select-text">
                    <code>
                      {"{\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"site"</span>: <span className="text-emerald-300">"{eventPayload.site}"</span>,{"\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"event"</span>: <span className="text-amber-300 font-semibold">"{eventPayload.event}"</span>,{"\n"}
                      {eventPayload.plugin ? (
                        <>
                          {"  "}<span className="text-emerald-400 font-semibold">"plugin"</span>: <span className="text-emerald-300">"{eventPayload.plugin}"</span>,{"\n"}
                          {"  "}<span className="text-emerald-400 font-semibold">"current"</span>: <span className="text-emerald-300">"{eventPayload.current}"</span>,{"\n"}
                          {"  "}<span className="text-emerald-400 font-semibold">"latest"</span>: <span className="text-emerald-300">"{eventPayload.latest}"</span>,{"\n"}
                        </>
                      ) : null}
                      {"  "}<span className="text-emerald-400 font-semibold">"severity"</span>: <span className="text-destructive font-semibold">"{eventPayload.severity}"</span>,{"\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"detected_at"</span>: <span className="text-emerald-300">"{eventPayload.detected_at}"</span>,{"\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"url"</span>: <span className="text-sky-400 underline">{eventPayload.url}</span>,{"\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"php_version"</span>: <span className="text-emerald-300">"{eventPayload.php_version}"</span>,{"\n"}
                      {"  "}<span className="text-emerald-400 font-semibold">"environment"</span>: <span className="text-emerald-300">"{eventPayload.environment}"</span>{"\n"}
                      {"}"}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Recent Activity Live Stream */}
              <div className="rounded-xl border border-border/80 bg-card/90 p-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    &gt; RECENT ACTIVITY
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-success">
                    <span>Live</span>
                    <span className="size-1.5 rounded-full bg-success pulse-live" />
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
                  {activities.map((act, i) => (
                    <div key={i} className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            act.tone === "critical" ? "bg-destructive" : act.tone === "warning" ? "bg-warning" : "bg-success",
                          )}
                        />
                        <span className="truncate text-foreground/90">{act.text}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 pl-2">{act.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mockup 2: 3-Column Cockpit */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Col 1: SITES */}
            <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-lg">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">SITES</span>
              <div className="mt-2 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between p-1.5 rounded bg-raised/50">
                  <span className="text-foreground font-semibold">agency-example.com</span>
                  <span className="text-success">512ms</span>
                </div>
                <div className="flex justify-between p-1.5 rounded hover:bg-raised/30">
                  <span className="text-foreground">woocommerce-store.com</span>
                  <span className="text-foreground">421ms</span>
                </div>
                <div className="flex justify-between p-1.5 rounded hover:bg-raised/30">
                  <span className="text-foreground">blog.marketinglab.io</span>
                  <span className="text-destructive">Down</span>
                </div>
                <div className="flex justify-between p-1.5 rounded hover:bg-raised/30">
                  <span className="text-foreground">careers-portal.net</span>
                  <span className="text-foreground">340ms</span>
                </div>
              </div>
            </div>

            {/* Col 2: Timeline & Response Time */}
            <div className="space-y-3">
              <div className="rounded-xl border border-border/80 bg-card p-3 shadow-lg">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">INCIDENT TIMELINE</span>
                <div className="mt-2 space-y-1.5 font-mono text-[10px]">
                  <div className="p-1.5 rounded bg-destructive/10 border border-destructive/20 text-destructive flex justify-between">
                    <span>blog.marketinglab.io</span>
                    <span className="font-bold">Site down</span>
                  </div>
                  <div className="p-1.5 rounded bg-warning/10 border border-warning/20 text-warning flex justify-between">
                    <span>plugin-updates.io</span>
                    <span className="font-bold">SSL cert</span>
                  </div>
                </div>
              </div>

              <ResponseTimeChart avgMs={512} />
            </div>

            {/* Col 3: Alert Details */}
            <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-lg font-mono text-[11px]">
              <div className="flex justify-between items-center pb-1.5 border-b border-border/50">
                <span className="text-muted-foreground uppercase text-[10px] font-bold">ALERT DETAILS</span>
                <span className="bg-destructive/20 text-destructive text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">CRITICAL</span>
              </div>
              <h5 className="font-bold text-xs text-foreground mt-2">blog.marketinglab.io is down</h5>
              <p className="text-[10px] text-muted-foreground">Since 10:19 AM (2m 32s)</p>

              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] bg-raised/50 p-2 rounded border border-border/50">
                <div>Check: <span className="text-foreground font-semibold">Uptime</span></div>
                <div>HTTP: <span className="text-destructive font-semibold">500</span></div>
                <div>Region: <span className="text-foreground">US East</span></div>
                <div>Locations: <span className="text-foreground">5</span></div>
              </div>

              <a
                href="/app"
                className="mt-3.5 flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#f97316] text-white py-1.5 font-semibold text-xs shadow-md"
              >
                <span>View in Dashboard</span>
                <ArrowRightIcon className="size-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
