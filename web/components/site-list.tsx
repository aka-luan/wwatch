import { ChevronDownIcon, CircleCheckIcon } from "lucide-react";
import { SiteRow } from "@/components/site-row";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { siteBoard, type BoardSite, type SiteBoard } from "@/lib/site-board";
import { filterEmptyHeading, filtersActive, type SiteFilterState } from "@/lib/site-filters";
import type { OverviewRow, SitePage } from "@/lib/types";

type SiteListProps = {
  sites: OverviewRow[];
  fleetCount: number;
  filters: SiteFilterState;
  onClearFilters?: () => void;
  loaded: boolean;
  selectedId: string | null;
  selectedPage: SitePage | null;
  onToggle: (id: string) => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
};

export function SiteList({
  sites,
  fleetCount,
  filters,
  onClearFilters,
  loaded,
  selectedId,
  selectedPage,
  onToggle,
  onEdit,
  onChanged,
}: SiteListProps) {
  const filtering = filtersActive(filters);

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
  if (sites.length === 0 && filtering) {
    return (
      <div className="empty empty-compact">
        <h2>{filterEmptyHeading(filters)}</h2>
        {onClearFilters ? (
          <p>
            <Button type="button" variant="link" className="h-auto px-0" onClick={onClearFilters}>
              Clear filters
            </Button>
          </p>
        ) : null}
      </div>
    );
  }

  const board = siteBoard(sites);
  const rowProps = { selectedId, selectedPage, onToggle, onEdit, onChanged };
  return (
    <div className="site-list">
      {filtering ? (
        <FilteredBoard board={board} {...rowProps} />
      ) : board.allHealthy ? (
        <AllHealthyNote count={sites.length} />
      ) : (
        <NeedsAttentionSection board={board} {...rowProps} />
      )}
      {!filtering && board.healthy.length > 0 ? (
        <>
          {board.needsAttention.length > 0 ? <Separator className="my-4" /> : null}
          <div className={board.needsAttention.length > 0 ? undefined : "mt-4"}>
            <HealthySection board={board} {...rowProps} />
          </div>
        </>
      ) : null}
    </div>
  );
}

type RowProps = {
  selectedId: string | null;
  selectedPage: SitePage | null;
  onToggle: (id: string) => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
};

function FilteredBoard({ board, ...rowProps }: { board: SiteBoard } & RowProps) {
  const mixed = board.needsAttention.length > 0 && board.healthy.length > 0;
  if (!mixed) {
    const items = board.needsAttention.length > 0 ? board.needsAttention : board.healthy;
    return <SiteRows items={items} {...rowProps} />;
  }
  return (
    <>
      <NeedsAttentionSection board={board} {...rowProps} />
      <Separator className="my-4" />
      <HealthySection board={board} allowCollapse={false} {...rowProps} />
    </>
  );
}

function NeedsAttentionSection({ board, ...rowProps }: { board: SiteBoard } & RowProps) {
  return (
    <section aria-labelledby="needs-attention-heading">
      <h2 id="needs-attention-heading" className="px-2 pb-1 text-sm font-medium">
        Needs attention
      </h2>
      <SiteRows items={board.needsAttention} {...rowProps} />
    </section>
  );
}

function HealthySection({
  board,
  allowCollapse = true,
  ...rowProps
}: { board: SiteBoard; allowCollapse?: boolean } & RowProps) {
  const heading = `Healthy · ${board.healthy.length}`;
  const rows = <SiteRows items={board.healthy} {...rowProps} />;

  if (allowCollapse && board.collapseHealthy) {
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

function SiteRows({ items, selectedId, selectedPage, onToggle, onEdit, onChanged }: { items: BoardSite[] } & RowProps) {
  return (
    <div>
      {items.map((item, index) => {
        const id = item.row.site.id;
        const expanded = selectedId === id;
        return (
          <div key={id}>
            {index > 0 ? <Separator /> : null}
            <SiteRow
              row={item.row}
              expanded={expanded}
              page={expanded ? selectedPage : null}
              onToggle={() => onToggle(id)}
              onEdit={onEdit}
              onChanged={onChanged}
            />
          </div>
        );
      })}
    </div>
  );
}
