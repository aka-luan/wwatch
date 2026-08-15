import { ChevronRightIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ago, host } from "@/lib/format";
import { siteOverview, siteRowCopy } from "@/lib/site-overview";
import { SITE_STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { OverviewRow } from "@/lib/types";

export function SiteList({
  sites,
  loaded,
  onOpen,
}: {
  sites: OverviewRow[];
  loaded: boolean;
  onOpen: (id: string) => void;
}) {
  if (!loaded) {
    return (
      <div className="site-list">
        <Skeleton className="h-16 w-full" />
        <Separator className="my-1" />
        <Skeleton className="h-16 w-full" />
        <Separator className="my-1" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (sites.length === 0) {
    return (
      <div className="empty">
        <h2>No sites yet</h2>
        <p>
          Add a WordPress site you already admin. wwatch talks to it with an Application Password from
          Users → Profile. Scans install nothing on the site. WP Admin from the site panel needs the
          optional wwatch plugin.
        </p>
      </div>
    );
  }
  return (
    <div className="site-list">
      {sites.map((row, index) => (
        <div key={row.site.id}>
          {index > 0 ? <Separator /> : null}
          <SiteRow row={row} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

function SiteRow({ row, onOpen }: { row: OverviewRow; onOpen: (id: string) => void }) {
  const overview = siteOverview(row);
  const copy = siteRowCopy(overview, ago);
  return (
    <button
      type="button"
      aria-label={`${row.site.name}, ${SITE_STATUS_LABEL[overview.status]}, ${copy.finding ?? copy.meta}`}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border-0 bg-transparent px-2 py-3 text-left text-foreground",
        "cursor-pointer appearance-none transition-colors",
        "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        overview.status === "critical" && "bg-destructive/[0.07] hover:bg-destructive/10 focus-visible:bg-destructive/10",
        overview.status === "attention" && "bg-warning/[0.07] hover:bg-warning/10 focus-visible:bg-warning/10",
      )}
      onClick={() => onOpen(row.site.id)}
    >
      <StatusDot status={overview.status} decorative className="mt-1.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "min-w-0 leading-5 [overflow-wrap:anywhere]",
              overview.emphasizePrimary ? "font-semibold" : "font-medium text-foreground/90",
            )}
          >
            {row.site.name}
          </span>
          <StatusBadge status={overview.status} className="shrink-0" />
        </span>
        <span className="mono host mt-0.5 block text-[13px]">{host(row.site.origin)}</span>
        {copy.finding ? <span className="mt-1 block text-sm leading-5 text-foreground">{copy.finding}</span> : null}
        {copy.meta ? <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{copy.meta}</span> : null}
      </span>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
