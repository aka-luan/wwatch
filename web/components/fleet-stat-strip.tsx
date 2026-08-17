import { Metric, MetricLabel, MetricValue, metricRail } from "@/components/metric";
import { fleetTable } from "@/lib/fleet-table";
import type { PrimaryStatusFilter, SiteFilterState } from "@/lib/site-filters";
import { TONE_FROM_STATUS, type Tone } from "@/lib/tone";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Counter = {
  filter: PrimaryStatusFilter | null;
  label: string;
  count: number;
  tone: Tone;
};

/**
 * The fleet in four numbers, three of which double as the primary filter. They read as
 * text with an underline when active, not as buttons.
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
    { filter: "critical", label: "Critical", count: counts.critical, tone: TONE_FROM_STATUS.critical },
    { filter: "attention", label: "Warning", count: counts.attention, tone: TONE_FROM_STATUS.attention },
    { filter: "healthy", label: "Healthy", count: counts.healthy, tone: TONE_FROM_STATUS.healthy },
    { filter: null, label: "Pending updates", count: counts.updates, tone: "neutral" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-2 bg-raised px-(--gutter) py-3">
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
          <Metric key={counter.label} value={counter.count} label={counter.label} tone={counter.tone} />
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
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "-mb-3 flex cursor-pointer flex-col items-start gap-1 rounded-sm bg-transparent pb-3 text-left",
        "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        metricRail(counter.tone, active),
      )}
    >
      <MetricValue tone={counter.tone}>{counter.count}</MetricValue>
      <MetricLabel active={active}>{counter.label}</MetricLabel>
    </button>
  );
}
