import { ChevronDownIcon, ChevronRightIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ago, host } from "@/lib/format";
import { siteBoard, type BoardSite, type SiteBoard } from "@/lib/site-board";
import { siteOverview, siteRowCopy } from "@/lib/site-overview";
import { SITE_STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { OverviewRow } from "@/lib/types";

export function SiteList({
  sites,
  fleetCount,
  filtersActive = false,
  onClearFilters,
  loaded,
  onOpen,
}: {
  sites: OverviewRow[];
  fleetCount: number;
  filtersActive?: boolean;
  onClearFilters?: () => void;
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
  if (fleetCount === 0) {
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
  if (sites.length === 0 && filtersActive) {
    return (
      <div className="empty empty-compact">
        <h2>No sites match these filters.</h2>
        {onClearFilters ? (
          <p>
            <button type="button" className="link-button" onClick={onClearFilters}>
              Clear filters
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  const board = siteBoard(sites);
  return (
    <div className="site-list">
      {board.allHealthy ? <AllHealthyNote count={sites.length} /> : <NeedsAttentionSection board={board} onOpen={onOpen} />}
      {board.healthy.length > 0 ? (
        <>
          {board.needsAttention.length > 0 ? <Separator className="my-4" /> : null}
          <div className={board.needsAttention.length > 0 ? undefined : "mt-4"}>
            <HealthySection board={board} onOpen={onOpen} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function NeedsAttentionSection({ board, onOpen }: { board: SiteBoard; onOpen: (id: string) => void }) {
  return (
    <section aria-labelledby="needs-attention-heading">
      <h2 id="needs-attention-heading" className="px-2 pb-1 text-sm font-medium">
        Needs attention
      </h2>
      <SiteRows items={board.needsAttention} density="full" onOpen={onOpen} />
    </section>
  );
}

function HealthySection({ board, onOpen }: { board: SiteBoard; onOpen: (id: string) => void }) {
  const heading = `Healthy · ${board.healthy.length}`;
  const rows = <SiteRows items={board.healthy} density="compact" onOpen={onOpen} />;

  if (board.collapseHealthy) {
    return (
      <section aria-labelledby="healthy-heading">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span id="healthy-heading">{heading}</span>
            <ChevronDownIcon
              className="size-4 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180"
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent>{rows}</CollapsibleContent>
        </Collapsible>
      </section>
    );
  }

  if (board.allHealthy) {
    return <section aria-label="Healthy">{rows}</section>;
  }

  return (
    <section aria-labelledby="healthy-heading">
      <h2 id="healthy-heading" className="px-2 pb-1 text-sm text-muted-foreground">
        {heading}
      </h2>
      {rows}
    </section>
  );
}

function AllHealthyNote({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1">
      <CircleCheckIcon className="mt-0.5 size-4 text-success" aria-hidden />
      <div>
        <p className="font-medium leading-5">All sites look healthy</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {count} {count === 1 ? "site" : "sites"} checked
        </p>
      </div>
    </div>
  );
}

function SiteRows({
  items,
  density,
  onOpen,
}: {
  items: BoardSite[];
  density: "full" | "compact";
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      {items.map((item, index) => (
        <div key={item.row.site.id}>
          {index > 0 ? <Separator /> : null}
          <SiteRow row={item.row} density={density} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

function SiteRow({
  row,
  density,
  onOpen,
}: {
  row: OverviewRow;
  density: "full" | "compact";
  onOpen: (id: string) => void;
}) {
  const overview = siteOverview(row);
  if (density === "compact") {
    const time = ago(overview.finishedAt);
    return (
      <button
        type="button"
        aria-label={`${row.site.name}, ${SITE_STATUS_LABEL[overview.status]}, ${host(row.site.origin)}, ${time}`}
        className={rowButtonClass("compact")}
        onClick={() => onOpen(row.site.id)}
      >
        <StatusDot status={overview.status} decorative />
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="max-w-[50%] shrink-0 truncate font-medium text-foreground/80">{row.site.name}</span>
          <span className="mono host min-w-0 truncate text-[13px]">{host(row.site.origin)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          {overview.running ? <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
          <span>{time}</span>
        </span>
      </button>
    );
  }

  const copy = siteRowCopy(overview, ago);
  return (
    <button
      type="button"
      aria-label={`${row.site.name}, ${SITE_STATUS_LABEL[overview.status]}, ${copy.finding ?? copy.meta}`}
      className={rowButtonClass("full")}
      onClick={() => onOpen(row.site.id)}
    >
      <StatusDot status={overview.status} decorative className="mt-1.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 font-semibold leading-5 [overflow-wrap:anywhere]">{row.site.name}</span>
            <span className="mono host min-w-0 truncate text-[13px]">{host(row.site.origin)}</span>
          </span>
          <StatusBadge status={overview.status} dot={false} className="shrink-0" />
        </span>
        {copy.finding ? <span className="mt-1 block text-sm leading-5 text-foreground">{copy.finding}</span> : null}
        {overview.running || copy.meta ? (
          <span className="mt-1 flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
            {overview.running ? <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
            {copy.meta ? <span>{copy.meta}</span> : null}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon
        className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground"
        aria-hidden
      />
    </button>
  );
}

function rowButtonClass(density: "full" | "compact"): string {
  return cn(
    "group flex w-full rounded-md border-0 bg-transparent px-2 text-left",
    "cursor-pointer appearance-none transition-colors duration-150",
    "hover:bg-muted/50 active:bg-muted/70 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    density === "compact"
      ? "items-center gap-3 py-1.5 text-muted-foreground"
      : "items-start gap-3 py-3 text-foreground",
  );
}
