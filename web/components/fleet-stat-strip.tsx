import { Button } from "@/components/ui/button";
import { fleetTable } from "@/lib/fleet-table";
import type { PrimaryStatusFilter, SiteFilterState } from "@/lib/site-filters";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Counter = {
  filter: PrimaryStatusFilter | null;
  label: string;
  count: number;
  tone: string;
  rail: string;
};

/**
 * Mockup 1a's stat strip: the fleet's state in four numbers, each of the three status
 * counters doubling as the primary filter.
 */
export function FleetStatStrip({
  sites,
  state,
  onChange,
  filtersSlot,
}: {
  sites: readonly OverviewRow[];
  state: SiteFilterState;
  onChange: (next: SiteFilterState) => void;
  filtersSlot?: React.ReactNode;
}) {
  const { counts } = fleetTable(sites);
  const counters: Counter[] = [
    { filter: "critical", label: "Critical", count: counts.critical, tone: "text-destructive", rail: "border-destructive" },
    { filter: "attention", label: "Warning", count: counts.attention, tone: "text-warning", rail: "border-warning" },
    { filter: "healthy", label: "Healthy", count: counts.healthy, tone: "text-success", rail: "border-success" },
    { filter: null, label: "Pending updates", count: counts.updates, tone: "text-foreground", rail: "border-foreground" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-border bg-raised px-5 py-3">
      {counters.map((counter) =>
        counter.filter ? (
          <FilterCounter
            key={counter.label}
            counter={counter}
            active={state.status === counter.filter}
            onClick={() =>
              onChange({
                ...state,
                status: state.status === counter.filter ? "all" : (counter.filter as PrimaryStatusFilter),
              })
            }
          />
        ) : (
          <div key={counter.label} className="flex flex-col gap-1">
            <span className={cn("font-mono text-[22px] leading-none font-semibold tabular-nums", counter.tone)}>
              {counter.count}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{counter.label}</span>
          </div>
        ),
      )}
      {filtersSlot ? <div className="ml-auto">{filtersSlot}</div> : null}
    </div>
  );
}

function FilterCounter({
  counter,
  active,
  onClick,
}: {
  counter: Counter;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "-mb-3 h-auto flex-col items-start gap-1 rounded-none border-b-2 border-transparent px-0 pb-3 hover:bg-transparent",
        active && counter.rail,
      )}
    >
      <span className={cn("font-mono text-[22px] leading-none font-semibold tabular-nums", counter.tone)}>
        {counter.count}
      </span>
      <span className={cn("text-[11.5px] font-normal", active ? "text-foreground" : "text-muted-foreground")}>
        {counter.label}
      </span>
    </Button>
  );
}
