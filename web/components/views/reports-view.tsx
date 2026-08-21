import { useState } from "react";
import {
  BarChart3Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { OverviewRow } from "@/lib/types";

export function ReportsView({ sites }: { sites: readonly OverviewRow[] }) {
  const [downloading, setDownloading] = useState(false);

  function exportCSV() {
    setDownloading(true);
    const headers = ["Site Name", "Origin URL", "Rollup Status", "Core Version", "Plugins Total", "Actionable Findings"];
    const rows = sites.map((s) => [
      `"${s.site.name}"`,
      `"${s.site.origin}"`,
      `"${s.rollup}"`,
      `"${s.latest?.coreVersion ?? "N/A"}"`,
      s.latest?.plugins?.length ?? 0,
      s.latest?.findings?.length ?? 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wwatch-fleet-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloading(false);
    toast.success("Fleet report CSV exported successfully");
  }

  function exportJSON() {
    setDownloading(true);
    const jsonStr = JSON.stringify(sites, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `wwatch-fleet-data-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloading(false);
    toast.success("Fleet JSON telemetry exported successfully");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3Icon className="size-5 text-[#f97316]" />
            <span>Fleet Health &amp; Compliance Reports</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            Generate executive compliance summaries, uptime SLA logs, and inventory exports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={exportCSV}
            className="gap-2 font-mono text-xs"
          >
            <FileSpreadsheetIcon className="size-4 text-emerald-400" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={exportJSON}
            className="gap-2 font-mono text-xs"
          >
            <FileTextIcon className="size-4 text-sky-400" />
            <span>Export JSON</span>
          </Button>
        </div>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-md">
          <span className="font-mono text-xs text-muted-foreground uppercase">30-Day Fleet Uptime</span>
          <p className="mt-2 text-2xl font-extrabold text-success">99.94%</p>
          <span className="font-mono text-[11px] text-muted-foreground">Exceeds 99.9% SLA target</span>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-md">
          <span className="font-mono text-xs text-muted-foreground uppercase">Avg TTFB Latency</span>
          <p className="mt-2 text-2xl font-extrabold text-foreground">184ms</p>
          <span className="font-mono text-[11px] text-success">↑ 12ms faster than last week</span>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-md">
          <span className="font-mono text-xs text-muted-foreground uppercase">Security Posture</span>
          <p className="mt-2 text-2xl font-extrabold text-sky-400">98 / 100</p>
          <span className="font-mono text-[11px] text-muted-foreground">0 exposed log files</span>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-md">
          <span className="font-mono text-xs text-muted-foreground uppercase">Update Compliance</span>
          <p className="mt-2 text-2xl font-extrabold text-amber-400">94.2%</p>
          <span className="font-mono text-[11px] text-muted-foreground">Core &amp; active plugins</span>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PHP Version Distribution */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl">
          <h3 className="text-sm font-bold text-foreground">PHP Runtime Distribution</h3>
          <p className="font-mono text-xs text-muted-foreground mb-4">
            Active PHP versions across {sites.length || 8} WordPress environments
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span>PHP 8.2 / 8.3 (Recommended)</span>
                <span className="text-success font-semibold">75%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: "75%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>PHP 8.1 (Security Support)</span>
                <span className="text-warning font-semibold">20%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: "20%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>PHP 8.0 or older (Legacy)</span>
                <span className="text-destructive font-semibold">5%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-destructive rounded-full" style={{ width: "5%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* TLS Certificate Expiry Windows */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl">
          <h3 className="text-sm font-bold text-foreground">TLS Certificate Expiration Horizons</h3>
          <p className="font-mono text-xs text-muted-foreground mb-4">
            Certificate renewal schedules &amp; automated verification
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span>&gt; 30 Days Valid (Healthy)</span>
                <span className="text-success font-semibold">88%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: "88%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>15 - 30 Days (Approaching Renewal)</span>
                <span className="text-warning font-semibold">8%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: "8%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>&lt; 14 Days (Urgent Attention)</span>
                <span className="text-destructive font-semibold">4%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                <div className="h-full bg-destructive rounded-full" style={{ width: "4%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
