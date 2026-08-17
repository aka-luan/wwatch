import { ChevronRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ago } from "@/lib/format";
import { fleetTable, TLS_WARN_DAYS, type FleetRow } from "@/lib/fleet-table";
import { TONE_RAIL_INSET, toneOf } from "@/lib/tone";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The narrow-viewport rendering of the fleet — the same rows and the same ordering as the
 * table, stacked. The design file has no mobile layout for 1a, so the nine columns collapse
 * to the three facts that fit: status, the leading finding, and what is pending.
 */
export function FleetCards({
  sites,
  loaded,
  onOpen,
}: {
  sites: readonly OverviewRow[];
  loaded: boolean;
  onOpen: (siteId: string) => void;
}) {
  if (!loaded) {
    return (
      <div className="flex flex-col gap-px" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-16 w-full rounded-none" />
        ))}
      </div>
    );
  }

  const { rows } = fleetTable(sites);

  return (
    <ul className="m-0 list-none p-0" aria-label="Sites, most urgent first">
      {rows.map((row) => (
        <li key={row.row.site.id}>
          <button
            type="button"
            onClick={() => onOpen(row.row.site.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 border-b border-hairline px-4 py-3 text-left outline-none",
              "hover:bg-selected focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
              TONE_RAIL_INSET[toneOf(row.status)],
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-foreground">{row.name}</span>
                <StatusBadge status={row.status} className="shrink-0">
                  {row.statusLabel}
                </StatusBadge>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">
                {row.hostname}
              </span>
              {row.finding ? (
                <span className="mt-1 block text-[13px] text-foreground [overflow-wrap:anywhere]">
                  {row.finding}
                  {row.findingExtra ? <span className="text-muted-foreground"> {row.findingExtra}</span> : null}
                </span>
              ) : null}
              <span className="mt-1 block text-[12px] text-muted-foreground">{metaLine(row)}</span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function metaLine(row: FleetRow): string {
  const parts: string[] = [];
  if (row.updates > 0) {
    parts.push(`${row.updates} update${row.updates === 1 ? "" : "s"}`);
  }
  if (row.tlsDaysLeft !== null && row.tlsDaysLeft <= TLS_WARN_DAYS) {
    parts.push(`TLS ${row.tlsDaysLeft}d`);
  }
  parts.push(row.running ? "scanning…" : `scanned ${ago(row.finishedAt)}`);
  return parts.join(" · ");
}
