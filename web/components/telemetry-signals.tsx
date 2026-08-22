import { useState } from "react";
import {
  ClockIcon,
  CloudIcon,
  GlobeIcon,
  LockIcon,
  Maximize2Icon,
  PuzzleIcon,
  ShieldAlertIcon,
  TerminalIcon,
} from "lucide-react";
import {
  deriveRecentActivity,
  deriveSignals,
  type SignalId,
} from "@/lib/telemetry";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  Globe: GlobeIcon,
  Lock: LockIcon,
  Puzzle: PuzzleIcon,
  Cloud: CloudIcon,
  Clock: ClockIcon,
  Terminal: TerminalIcon,
  Shield: ShieldAlertIcon,
};

export function TelemetrySignals({
  sites,
  className,
  onOpenSignal,
}: {
  sites: readonly OverviewRow[];
  className?: string;
  onOpenSignal?: (signalId: SignalId) => void;
}) {
  const signals = deriveSignals(sites);
  const activities = deriveRecentActivity(sites);
  const [selectedSignal, setSelectedSignal] = useState<SignalId>("updates");
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate dynamic JSON event details based on selected signal or first site
  const firstSite = sites[0]?.site;
  const siteHost = firstSite ? firstSite.origin.replace(/^https?:\/\//, "") : "agency-example.com";
  const siteUrl = firstSite ? `${firstSite.origin}/wp-admin/` : "https://agency-example.com/wp-admin/";

  const activeSignal = signals.find((s) => s.id === selectedSignal) ?? signals[0];

  const eventPayload = {
    site: siteHost,
    event:
      selectedSignal === "updates"
        ? "plugin_update_available"
        : selectedSignal === "uptime"
          ? "uptime_check_completed"
          : selectedSignal === "ssl"
            ? "ssl_expiry_warning"
            : selectedSignal === "backups"
              ? "backup_verification_ok"
              : selectedSignal === "performance"
                ? "php_runtime_check"
                : selectedSignal === "cron"
                  ? "cron_execution_failure"
                  : "anomaly_incident_detected",
    ...(selectedSignal === "updates"
      ? {
          plugin: "woocommerce",
          current: "8.6.1",
          latest: "8.7.0",
        }
      : selectedSignal === "ssl"
        ? {
            days_left: 28,
            issuer: "Let's Encrypt R11",
            valid_until: "2026-09-17T00:00:00Z",
          }
        : selectedSignal === "performance"
          ? {
              health_score: 92,
              memory_limit: "256M",
              php_version: "8.2.20",
            }
          : {}),
    severity: activeSignal?.status ?? "healthy",
    detected_at: new Date().toISOString(),
    url: siteUrl,
    php_version: "8.1.22",
    environment: "production",
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-12 gap-5 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md",
        className,
      )}
    >
      {/* Left Column: Monitored Signals */}
      <div className="lg:col-span-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            MONITORED SIGNALS
          </h3>
          <span className="font-mono text-[11px] text-muted-foreground/80">
            {signals.length} active monitors
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {signals.map((signal) => {
            const Icon = SIGNAL_ICONS[signal.iconName] || GlobeIcon;
            const isSelected = selectedSignal === signal.id;
            return (
              <button
                key={signal.id}
                type="button"
                onClick={() => {
                  setSelectedSignal(signal.id);
                  onOpenSignal?.(signal.id);
                }}
                className={cn(
                  "group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all duration-200",
                  isSelected
                    ? "border-ring/40 bg-raised shadow-md shadow-black/20 ring-1 ring-ring/30"
                    : "border-border/60 bg-raised/40 hover:border-border hover:bg-raised/70",
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                      isSelected
                        ? "border-ring/40 bg-ring/10 text-foreground"
                        : "border-border/50 bg-card/80 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground tracking-tight">
                      {signal.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {signal.subtitle}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  <SignalPill status={signal.status} count={signal.count} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Event Details & Recent Activity */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Event Details Card */}
        <div className="flex flex-col rounded-xl border border-border/80 bg-card/90 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-raised/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  activeSignal?.status === "critical"
                    ? "bg-destructive"
                    : activeSignal?.status === "warning"
                      ? "bg-warning"
                      : "bg-success",
                )}
              />
              <span className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
                EVENT DETAILS
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span>2m ago</span>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Expand event details"
              >
                <Maximize2Icon className="size-3.5" />
              </button>
            </div>
          </div>

          <div
            className={cn(
              "overflow-x-auto p-4 font-mono text-[12px] leading-relaxed transition-all duration-300 telemetry-scroll",
              isExpanded ? "max-h-[360px]" : "max-h-[220px]",
            )}
          >
            <JsonHighlight data={eventPayload} />
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="flex flex-col rounded-xl border border-border/80 bg-card/90 p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground tracking-wide">
              <span>&gt; RECENT ACTIVITY</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-success">
              <span>Live</span>
              <span className="size-2 rounded-full bg-success pulse-live" />
            </div>
          </div>

          <div className="mt-3 space-y-2 font-mono text-[12px]">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-2 py-0.5 transition-colors hover:text-foreground"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      act.severity === "critical"
                        ? "bg-destructive"
                        : act.severity === "warning"
                          ? "bg-warning"
                          : "bg-success",
                    )}
                  />
                  <span className="truncate text-foreground/90">{act.text}</span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalPill({
  status,
  count,
}: {
  status: "healthy" | "warning" | "critical";
  count?: number;
}) {
  const isHealthy = status === "healthy";
  const isWarning = status === "warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium border",
        isHealthy && "border-success/30 bg-success/10 text-success",
        isWarning && "border-warning/30 bg-warning/10 text-warning",
        !isHealthy && !isWarning && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isHealthy && "bg-success",
          isWarning && "bg-warning",
          !isHealthy && !isWarning && "bg-destructive",
        )}
      />
      <span>
        {isHealthy ? "Healthy" : isWarning ? "Warning" : "Critical"}
        {count !== undefined && count > 0 ? ` (${count})` : ""}
      </span>
    </span>
  );
}

function JsonHighlight({ data }: { data: Record<string, unknown> }) {
  const jsonStr = JSON.stringify(data, null, 2);

  // Syntax highlighting parser
  const lines = jsonStr.split("\n");

  return (
    <pre className="text-foreground/90 font-mono text-[12px] select-text">
      <code>
        {lines.map((line, idx) => {
          // Format keys, strings, numbers, links
          const keyMatch = line.match(/^(\s*)"([^"]+)": (.*)$/);
          if (keyMatch) {
            const [, indent, key, value] = keyMatch;
            const valStr = value ?? "";
            const isUrl = typeof valStr === "string" && valStr.includes("http");
            const isSeverity = key === "severity";
            const isEvent = key === "event";

            return (
              <div key={idx}>
                <span>{indent}</span>
                <span className="text-emerald-400 font-semibold">"{key}"</span>:{" "}
                {isUrl ? (
                  <span className="text-sky-400 underline decoration-sky-400/40">{valStr}</span>
                ) : isSeverity ? (
                  <span
                    className={cn(
                      "font-semibold",
                      valStr.includes("critical")
                        ? "text-destructive"
                        : valStr.includes("warning")
                          ? "text-warning"
                          : "text-success",
                    )}
                  >
                    {valStr}
                  </span>
                ) : isEvent ? (
                  <span className="text-amber-300 font-medium">{valStr}</span>
                ) : (
                  <span className="text-emerald-300/90">{valStr}</span>
                )}
              </div>
            );
          }
          return <div key={idx}>{line}</div>;
        })}
      </code>
    </pre>
  );
}
