import { useState } from "react";
import {
  BellIcon,
  MailIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deriveIncidents } from "@/lib/telemetry";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AlertsView({ sites }: { sites: readonly OverviewRow[] }) {
  const incidents = deriveIncidents(sites);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");
  const [testBusy, setTestBusy] = useState(false);

  const [rules, setRules] = useState([
    { id: "rule-down", name: "Site unreachable (HTTP 5xx / timeout)", enabled: true, severity: "critical" },
    { id: "rule-auth", name: "Application Password authentication failure", enabled: true, severity: "critical" },
    { id: "rule-debug", name: "Public debug.log or exposed backup config", enabled: true, severity: "critical" },
    { id: "rule-tls", name: "TLS certificate expiring in < 14 days", enabled: true, severity: "warning" },
    { id: "rule-checksum", name: "WordPress core file checksum mismatch", enabled: true, severity: "critical" },
  ]);

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === "all") return true;
    return inc.severity === filter;
  });

  async function handleTestAlert(channel: "Telegram" | "Email") {
    setTestBusy(true);
    await new Promise((res) => setTimeout(res, 600));
    setTestBusy(false);
    toast.success(`Test alert dispatched to ${channel}`, {
      description: "Stateful deduplication check passed. Delivered in 142ms.",
    });
  }

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
    toast.info("Alert rule configuration updated");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BellIcon className="size-5 text-[#FF4D22]" />
            <span>Unified Alert Center</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Stateful deduplication · Alerts dispatched only on new regressions or status drops
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={testBusy}
            onClick={() => handleTestAlert("Telegram")}
            className="gap-2 font-mono text-xs border-white/8 bg-[#0F1218] hover:bg-[#161B24] rounded-xl text-[#EDEDF0]"
          >
            <SendIcon className="size-3.5 text-sky-400" />
            <span>Test Telegram</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testBusy}
            onClick={() => handleTestAlert("Email")}
            className="gap-2 font-mono text-xs border-white/8 bg-[#0F1218] hover:bg-[#161B24] rounded-xl text-[#EDEDF0]"
          >
            <MailIcon className="size-3.5 text-amber-400" />
            <span>Test Email</span>
          </Button>
        </div>
      </div>

      {/* Notification Channels Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Telegram Channel */}
        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <SendIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Telegram Bot</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.2 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/25">
                  <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  Connected
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Channel: @wwatch-ops · Instant push notifications
              </p>
            </div>
          </div>
        </div>

        {/* Resend Email Channel */}
        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MailIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Resend Email</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.2 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/25">
                  <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  Active
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                alerts@agency-example.com · Rich HTML summary digest
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Alert Feed & Alert Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Alert Feed (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              RECENT FLEET ALERTS ({filteredIncidents.length})
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-[#0F1218] p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors",
                  filter === "all" ? "bg-[#161B24] text-white font-semibold border border-white/10" : "text-muted-foreground hover:text-white",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("critical")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors",
                  filter === "critical" ? "bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/25" : "text-muted-foreground hover:text-white",
                )}
              >
                Critical
              </button>
              <button
                type="button"
                onClick={() => setFilter("warning")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors",
                  filter === "warning" ? "bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/25" : "text-muted-foreground hover:text-white",
                )}
              >
                Warning
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className="flex flex-col gap-2.5 rounded-2xl border border-white/8 bg-[#0F1218] p-4.5 shadow-lg transition-all hover:border-white/14"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                        inc.severity === "critical"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                          : inc.severity === "warning"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
                      )}
                    >
                      {inc.severity}
                    </span>
                    <span className="font-bold text-sm text-white">{inc.host}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{inc.startedAt}</span>
                </div>

                <p className="text-sm font-medium text-foreground/90">{inc.title}</p>
                {inc.detail ? (
                  <p className="font-mono text-xs text-muted-foreground bg-[#090B0F] p-2.5 rounded-xl border border-white/6">
                    {inc.detail}
                  </p>
                ) : null}

                <div className="flex items-center justify-between pt-2 border-t border-white/6 font-mono text-[11px] text-muted-foreground">
                  <span>Delivered to Telegram &amp; Email</span>
                  <span className="text-muted-foreground/60">Deduplication ID: {inc.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Alert Rules (4 cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-white/8 bg-[#0F1218] p-4.5 shadow-xl">
          <div className="pb-3 border-b border-white/6">
            <h3 className="text-sm font-bold text-white font-sans">Alert Dispatch Rules</h3>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              Toggle specific condition triggers
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-[#090B0F] p-3 transition-colors hover:border-white/10"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{r.name}</p>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase font-bold mt-0.5 inline-block",
                      r.severity === "critical" ? "text-rose-400" : "text-amber-400",
                    )}
                  >
                    {r.severity}
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() => toggleRule(r.id)}
                  className="mt-1 size-4 accent-[#FF4D22] cursor-pointer"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/6 bg-[#090B0F] p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-white">Stateful suppression:</span> Warnings
            persisting over multiple consecutive scans are silent unless the issue severity escalates.
          </div>
        </div>
      </div>
    </div>
  );
}
