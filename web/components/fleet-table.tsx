import type { MouseEvent } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ago } from "@/lib/format";
import { fleetTable, TLS_WARN_DAYS, type FleetRow } from "@/lib/fleet-table";
import { TONE_RAIL_INSET, toneOf } from "@/lib/tone";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The table only renders above 840px (below it the fleet is a card list), so the one
 * breakpoint here drops the two least important columns — Core and Last scan — before the
 * layout gets tight. Site, Status, Findings and Updates always survive.
 */
const SECONDARY = "hidden lg:table-cell";

const COLUMNS = [
  { key: "site", label: "Site", hidden: false, className: "min-w-[180px]" },
  { key: "status", label: "Status", hidden: false, className: "min-w-[104px]" },
  { key: "findings", label: "Findings", hidden: false, className: "min-w-[130px]" },
  { key: "updates", label: "Updates", hidden: false, className: "min-w-[76px]" },
  { key: "tls", label: "TLS", hidden: false, className: "min-w-[68px]" },
  { key: "core", label: "Core", hidden: false, className: cn("min-w-[80px]", SECONDARY) },
  { key: "scan", label: "Last scan", hidden: false, className: cn("min-w-[96px]", SECONDARY) },
  { key: "open", label: "Open", hidden: true, className: "w-[40px] pr-(--gutter)" },
] as const;

/** Data the site does not have. One dash everywhere, always muted. */
function Dash() {
  return <span className="text-muted-foreground">&mdash;</span>;
}

export type FleetTableProps = {
  sites: readonly OverviewRow[];
  loaded: boolean;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  onOpen: (siteId: string) => void;
};

export function FleetTable({ sites, loaded, selectedIds, onSelectionChange, onOpen }: FleetTableProps) {
  const table = fleetTable(sites);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-px" aria-hidden>
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-13 w-full rounded-none" />
        ))}
      </div>
    );
  }

  const selectable = table.rows.filter((row) => row.updatable);
  const allSelected = selectable.length > 0 && selectable.every((row) => selectedIds.has(row.row.site.id));
  const someSelected = selectable.some((row) => selectedIds.has(row.row.site.id));

  function toggle(siteId: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(siteId);
    } else {
      next.delete(siteId);
    }
    onSelectionChange(next);
  }

  function toggleAll(checked: boolean) {
    onSelectionChange(checked ? new Set(selectable.map((row) => row.row.site.id)) : new Set());
  }

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        Every site in the fleet, most urgent first. Sites with pending updates can be selected for a bulk update.
      </caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="w-[34px] py-2 pl-(--gutter)">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              disabled={selectable.length === 0}
              onCheckedChange={toggleAll}
              aria-label="Select every site with pending updates"
            />
          </th>
          {COLUMNS.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={cn(
                "py-2.5 pr-4 text-[12px] leading-none font-mono font-medium text-muted-foreground",
                column.className,
              )}
            >
              {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {table.rows.map((row) => (
          <FleetTableRow
            key={row.row.site.id}
            row={row}
            selected={selectedIds.has(row.row.site.id)}
            onToggle={(checked) => toggle(row.row.site.id, checked)}
            onOpen={() => onOpen(row.row.site.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

function FleetTableRow({
  row,
  selected,
  onToggle,
  onOpen,
}: {
  row: FleetRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const tlsWarn = row.tlsDaysLeft !== null && row.tlsDaysLeft <= TLS_WARN_DAYS;
  const selectLabel = row.updatable
    ? `Select ${row.name} for a bulk update`
    : `${row.name} has no updates that can run from the board`;

  /*
   * The whole row opens the site, but the checkbox and the two buttons inside it keep their
   * own behaviour — a click that started on one of those is theirs, not the row's.
   */
  function onRowClick(event: MouseEvent<HTMLTableRowElement>) {
    if (event.target instanceof Element && event.target.closest("button, input, a, [data-slot='checkbox']")) {
      return;
    }
    onOpen();
  }

  return (
    <tr
      onClick={onRowClick}
      className={cn(
        "cursor-pointer border-b border-hairline transition-colors hover:bg-selected",
        "has-[:focus-visible]:bg-selected",
        selected && "bg-selected",
        TONE_RAIL_INSET[toneOf(row.status)],
      )}
    >
      <td className="py-3 pl-(--gutter) align-middle">
        <Checkbox
          checked={selected}
          disabled={!row.updatable}
          onCheckedChange={onToggle}
          aria-label={selectLabel}
        />
      </td>
      <td className="min-w-[180px] py-3 pr-4 align-middle">
        <button
          type="button"
          onClick={onOpen}
          className="-my-1 flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-sm py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="text-[13.5px] leading-4 font-semibold text-foreground">{row.name}</span>
          <span className="font-mono text-[12px] leading-4 text-muted-foreground">{row.hostname}</span>
        </button>
      </td>
      <td className="py-3 pr-4 align-middle">
        <StatusBadge status={row.status}>{row.statusLabel}</StatusBadge>
      </td>
      <td className="py-3 pr-4 align-middle text-[12.5px] leading-4 text-foreground">
        {row.finding ? (
          <span className="[overflow-wrap:anywhere]">
            {row.finding}
            {row.findingExtra ? <span className="text-muted-foreground"> {row.findingExtra}</span> : null}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className="py-3 pr-4 align-middle">
        {row.updates > 0 ? (
          <span
            className={cn(
              "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 font-mono text-[12px] leading-4 tabular-nums",
              row.status === "healthy"
                ? "bg-foreground/6 text-muted-foreground"
                : "bg-foreground/12 text-foreground",
            )}
          >
            {row.updates}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td
        className={cn(
          "py-3 pr-4 align-middle font-mono text-[12.5px] leading-4 tabular-nums",
          tlsWarn ? "text-warning" : "text-muted-foreground",
        )}
      >
        {row.tlsDaysLeft === null ? <Dash /> : `${row.tlsDaysLeft}d`}
      </td>
      <td
        className={cn(
          "py-3 pr-4 align-middle font-mono text-[12.5px] leading-4 tabular-nums text-muted-foreground",
          SECONDARY,
        )}
      >
        {row.coreVersion ?? <Dash />}
      </td>
      <td
        className={cn(
          "py-3 pr-4 align-middle text-[12.5px] leading-4",
          SECONDARY,
          row.stale ? "text-warning" : "text-muted-foreground",
        )}
      >
        {row.running ? "scanning…" : ago(row.finishedAt)}
      </td>
      <td className="w-[40px] py-3 pr-(--gutter) text-right align-middle">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Open ${row.name}`}
        >
          <ChevronRightIcon className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}
