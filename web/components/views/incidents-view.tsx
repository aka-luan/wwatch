import { useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deriveIncidents, type Incident } from "@/lib/telemetry";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IncidentsView({ sites }: { sites: readonly OverviewRow[] }) {
  const [incidentsList, setIncidentsList] = useState<Incident[]>(() => deriveIncidents(sites));
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "investigating" | "resolved">("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const filtered = incidentsList.filter((inc) => {
    if (statusFilter === "all") return true;
    return inc.status === statusFilter;
  });

  const activeCount = incidentsList.filter((i) => i.status === "active").length;
  const investigatingCount = incidentsList.filter((i) => i.status === "investigating").length;
  const resolvedCount = incidentsList.filter((i) => i.status === "resolved").length;

  function handleResolve(id: string) {
    setIncidentsList((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "resolved", severity: "resolved", duration: "Resolved just now" } : i)),
    );
    setSelectedIncident(null);
    toast.success("Incident marked as resolved", {
      description: "Root cause verification verified. Incident closed.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-[#FF4D22]" />
            <span>Incident Command Center</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Triage, investigate, and resolve production outages &amp; security regressions
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-[#0F1218] p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1 font-medium transition-colors",
              statusFilter === "all" ? "bg-[#161B24] text-white font-semibold border border-white/10" : "text-muted-foreground hover:text-white",
            )}
          >
            All ({incidentsList.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "rounded-lg px-3 py-1 font-medium transition-colors",
              statusFilter === "active" ? "bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/25" : "text-muted-foreground hover:text-white",
            )}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("investigating")}
            className={cn(
              "rounded-lg px-3 py-1 font-medium transition-colors",
              statusFilter === "investigating" ? "bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/25" : "text-muted-foreground hover:text-white",
            )}
          >
            Investigating ({investigatingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={cn(
              "rounded-lg px-3 py-1 font-medium transition-colors",
              statusFilter === "resolved" ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25" : "text-muted-foreground hover:text-white",
            )}
          >
            Resolved ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((inc) => (
          <div
            key={inc.id}
            className="flex flex-col justify-between rounded-2xl border border-white/8 bg-[#0F1218] p-4.5 shadow-xl transition-all hover:border-white/14"
          >
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-white/6">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {inc.startedAt}
                </span>
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
              </div>

              <div className="mt-3">
                <h4 className="font-bold text-sm text-white">{inc.host}</h4>
                <p className="mt-1 text-xs text-foreground/90 font-medium">{inc.title}</p>
                {inc.detail ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground bg-[#090B0F] p-2.5 rounded-xl border border-white/6">
                    {inc.detail}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-muted-foreground">
                <div>Check: <span className="text-white font-medium">{inc.checkType}</span></div>
                <div>Code: <span className="text-white font-medium">{inc.httpCode}</span></div>
                <div>Region: <span className="text-white font-medium">{inc.region}</span></div>
                <div>Duration: <span className="text-white font-medium">{inc.duration}</span></div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIncident(inc)}
                className="w-full text-xs font-mono border-white/8 bg-[#090B0F] hover:bg-[#161B24] rounded-xl text-[#EDEDF0]"
              >
                Inspect Timeline
              </Button>
              {inc.status !== "resolved" ? (
                <Button
                  size="sm"
                  onClick={() => handleResolve(inc.id)}
                  className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-mono rounded-xl shrink-0"
                >
                  Resolve
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Incident Detail Modal */}
      <Dialog open={Boolean(selectedIncident)} onOpenChange={(open) => !open && setSelectedIncident(null)}>
        <DialogContent className="sm:max-w-xl border-white/10 bg-[#0F1218] text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-base font-bold text-white">
              <span>Incident Diagnostics:</span>
              <span className="text-rose-400">{selectedIncident?.host}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedIncident ? (
            <div className="space-y-4 font-mono text-xs mt-2">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/6 bg-[#090B0F] p-3.5">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Title</span>
                  <span className="font-semibold text-white">{selectedIncident.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Severity</span>
                  <span className="font-semibold uppercase text-rose-400">{selectedIncident.severity}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Status</span>
                  <span className="font-semibold capitalize text-amber-400">{selectedIncident.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Started At</span>
                  <span className="font-semibold text-white">{selectedIncident.startedAt} ({selectedIncident.duration})</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] font-semibold uppercase mb-1.5">
                  Recent Heartbeat Timeline
                </span>
                <div className="space-y-1.5 rounded-xl border border-white/6 bg-[#090B0F] p-3">
                  {selectedIncident.recentChecks.map((chk, i) => (
                    <div key={i} className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-white/80">{chk.time}</span>
                        <span>•</span>
                        <span className={chk.status === "Down" ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {chk.status}
                        </span>
                      </div>
                      <span className="text-white">{chk.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedIncident(null)}
              className="border-white/8 bg-[#090B0F] hover:bg-[#161B24] rounded-xl"
            >
              Close
            </Button>
            {selectedIncident && selectedIncident.status !== "resolved" ? (
              <Button
                type="button"
                onClick={() => handleResolve(selectedIncident.id)}
                className="bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl"
              >
                <CheckCircle2Icon className="size-4 mr-1" />
                <span>Mark as Resolved</span>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
