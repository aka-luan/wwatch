import { ChevronRightIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/status-dot";
import { ago } from "@/lib/format";
import { fleetTable, TLS_WARN_DAYS, type FleetRow } from "@/lib/fleet-table";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "site", label: "Site", hidden: false, className: "min-w-[230px]" },
  { key: "status", label: "Status", hidden: false, className: "w-[116px]" },
  { key: "findings", label: "Findings", hidden: false, className: "w-[150px]" },
  { key: "updates", label: "Updates", hidden: false, className: "w-[96px]" },
  { key: "tls", label: "TLS", hidden: false, className: "w-[92px]" },
  { key: "core", label: "Core", hidden: false, className: "w-[104px]" },
  { key: "scan", label: "Last scan", hidden: false, className: "w-[120px]" },
  { key: "open", label: "Open", hidden: true, className: "w-[40px] pr-5" },
] as const;

const RAIL: Record<FleetRow["status"], string> = {
  critical: "shadow-[inset_3px_0_0_var(--destructive)]",
  attention: "shadow-[inset_3px_0_0_var(--warning)]",
  healthy: "shadow-[inset_3px_0_0_var(--border)]",
  unknown: "shadow-[inset_3px_0_0_var(--border)]",
};

const STATUS_TEXT: Record<FleetRow["status"], string> = {
  critical: "font-semibold text-destructive",
  attention: "font-semibold text-warning",
  healthy: "text-muted-foreground",
  unknown: "text-muted-foreground",
};

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
          <Skeleton key={index} className="h-11 w-full rounded-none" />
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
        <tr className="border-b border-border bg-raised">
          <th scope="col" className="w-[34px] py-2 pl-5">
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
                "py-2 pr-4 text-[10.5px] leading-none font-semibold tracking-[0.07em] text-muted-foreground uppercase",
                column.className,
              )}
            >
              {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
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

  return (
    <tr
      className={cn(
        "border-b border-hairline transition-colors hover:bg-selected",
        selected && "bg-selected",
        RAIL[row.status],
      )}
    >
      <td className="py-2.5 pl-5 align-middle">
        <Checkbox
          checked={selected}
          disabled={!row.updatable}
          onCheckedChange={onToggle}
          aria-label={selectLabel}
        />
      </td>
      <td className="min-w-[230px] py-2.5 pr-4 align-middle">
        <button
          type="button"
          onClick={onOpen}
          className="-my-1 flex w-full flex-col items-start gap-0.5 rounded-sm py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="text-[13px] leading-4 font-semibold text-foreground">{row.name}</span>
          <span className="font-mono text-[12px] leading-4 text-muted-foreground">{row.hostname}</span>
        </button>
      </td>
      <td className="w-[116px] py-2.5 pr-4 align-middle">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={row.status} decorative className="size-[7px]" />
          <span className={cn("text-[12.5px] leading-4", STATUS_TEXT[row.status])}>{row.statusLabel}</span>
        </span>
      </td>
      <td className="w-[150px] py-2.5 pr-4 align-middle text-[12.5px] leading-4 text-foreground">
        {row.finding ? (
          <span className="[overflow-wrap:anywhere]">
            {row.finding}
            {row.findingExtra ? <span className="text-muted-foreground"> {row.findingExtra}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td className="w-[96px] py-2.5 pr-4 align-middle">
        {row.updates > 0 ? (
          <span
            className={cn(
              "inline-block rounded border border-border px-[7px] py-0.5 font-mono text-[12.5px] leading-4",
              row.status === "healthy" ? "bg-card text-muted-foreground" : "bg-secondary text-foreground",
            )}
          >
            {row.updates}
          </span>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td
        className={cn(
          "w-[92px] py-2.5 pr-4 align-middle font-mono text-[12.5px] leading-4",
          tlsWarn ? "text-warning" : "text-muted-foreground",
        )}
      >
        {row.tlsDaysLeft === null ? "—" : `${row.tlsDaysLeft}d`}
      </td>
      <td className="w-[104px] py-2.5 pr-4 align-middle font-mono text-[12.5px] leading-4 text-muted-foreground">
        {row.coreVersion ?? "—"}
      </td>
      <td
        className={cn(
          "w-[120px] py-2.5 pr-4 align-middle text-[12.5px] leading-4",
          row.stale ? "text-warning" : "text-muted-foreground",
        )}
      >
        {row.running ? "scanning…" : ago(row.finishedAt)}
      </td>
      <td className="w-[40px] py-2.5 pr-5 text-right align-middle">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Open ${row.name}`}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </td>
    </tr>
  );
}
