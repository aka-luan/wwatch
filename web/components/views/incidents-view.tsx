import { useState } from "react";
import { FlameIcon } from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FlameIcon className="size-5 text-destructive" />
            <span>Incident Command Center</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            Triage, investigate, and resolve production outages &amp; security regressions
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-card p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded px-3 py-1 font-medium transition-colors",
              statusFilter === "all" ? "bg-raised text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            All ({incidentsList.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "rounded px-3 py-1 font-medium transition-colors",
              statusFilter === "active" ? "bg-destructive/20 text-destructive font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("investigating")}
            className={cn(
              "rounded px-3 py-1 font-medium transition-colors",
              statusFilter === "investigating" ? "bg-warning/20 text-warning font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Investigating ({investigatingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={cn(
              "rounded px-3 py-1 font-medium transition-colors",
              statusFilter === "resolved" ? "bg-success/20 text-success font-semibold" : "text-muted-foreground hover:text-foreground",
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
            className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xl transition-all hover:border-border"
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {inc.startedAt}
                </span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                    inc.severity === "critical"
                      ? "bg-destructive/20 text-destructive border border-destructive/30"
                      : inc.severity === "warning"
                        ? "bg-warning/20 text-warning border border-warning/30"
                        : "bg-success/20 text-success border border-success/30",
                  )}
                >
                  {inc.severity}
                </span>
              </div>

              <div className="mt-3">
                <h4 className="font-bold text-sm text-foreground">{inc.host}</h4>
                <p className="mt-1 text-xs text-foreground/90 font-medium">{inc.title}</p>
                {inc.detail ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground bg-raised/40 p-2 rounded">
                    {inc.detail}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-muted-foreground">
                <div>Check: <span className="text-foreground">{inc.checkType}</span></div>
                <div>Code: <span className="text-foreground">{inc.httpCode}</span></div>
                <div>Region: <span className="text-foreground">{inc.region}</span></div>
                <div>Duration: <span className="text-foreground">{inc.duration}</span></div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIncident(inc)}
                className="w-full text-xs font-mono"
              >
                Inspect Timeline
              </Button>
              {inc.status !== "resolved" ? (
                <Button
                  size="sm"
                  onClick={() => handleResolve(inc.id)}
                  className="bg-success/20 text-success hover:bg-success/30 border border-success/30 text-xs font-mono"
                >
                  Resolve
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident ? (
        <Dialog open={!!selectedIncident} onOpenChange={(open) => !open && setSelectedIncident(null)}>
          <DialogContent className="max-w-xl border-border bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Incident Diagnostics: {selectedIncident.host}</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-xs uppercase",
                    selectedIncident.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning",
                  )}
                >
                  {selectedIncident.severity}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 font-mono text-xs">
              <div className="rounded-lg border border-border/60 bg-raised/50 p-3">
                <p className="font-semibold text-foreground">{selectedIncident.title}</p>
                <p className="text-muted-foreground mt-1">{selectedIncident.detail}</p>
              </div>

              <div>
                <h5 className="font-semibold text-foreground uppercase tracking-wider mb-2">
                  Probe History &amp; Timeline
                </h5>
                <div className="space-y-1.5">
                  {selectedIncident.recentChecks.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-raised/30 border border-border/40">
                      <span>{c.time} UTC</span>
                      <span className={cn(c.status === "Down" ? "text-destructive" : "text-success")}>
                        {c.status} ({c.code})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedIncident(null)}>
                Close
              </Button>
              {selectedIncident.status !== "resolved" ? (
                <Button
                  onClick={() => handleResolve(selectedIncident.id)}
                  className="bg-success text-black hover:bg-success/90 font-semibold"
                >
                  Mark as Resolved
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
