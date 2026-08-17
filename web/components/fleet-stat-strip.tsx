import type { ReactNode } from "react";

import { MetricLabel, MetricValue } from "@/components/metric";
import { StatusDot } from "@/components/status-dot";
import { cardVariants } from "@/components/ui/card";
import { fleetTable } from "@/lib/fleet-table";
import type { PrimaryStatusFilter, SiteFilterState } from "@/lib/site-filters";
import { TONE_FROM_STATUS, TONE_RAIL_STRONG, type Tone } from "@/lib/tone";
import type { OverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Counter = {
  filter: PrimaryStatusFilter | null;
  label: string;
  count: number;
  tone: Tone;
};

/**
 * The fleet in four numbers, three of which double as the primary filter. Each is a
 * compact card: a status dot, the count, and a muted label. Color is an accent on the
 * dot and on the border of the active card, never a filled surface.
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
    <div className="px-(--gutter) py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counters.map((counter) =>
          counter.filter ? (
            <FilterCounterCard
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
            <MetricCard key={counter.label} counter={counter} />
          ),
        )}
      </div>
      {filtersSlot ? <div className="mt-2">{filtersSlot}</div> : null}
    </div>
  );
}

const CARD = "gap-1 px-3.5 py-3";

function MetricCard({ counter }: { counter: Counter }) {
  return (
    <div className={cn(cardVariants(), CARD)} data-slot="card">
      <CounterBody counter={counter} />
    </div>
  );
}

function FilterCounterCard({
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
      data-slot="card"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        cardVariants(),
        CARD,
        "cursor-pointer text-left transition-colors",
        "hover:bg-selected outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active && cn("bg-selected", TONE_RAIL_STRONG[counter.tone]),
      )}
    >
      <CounterBody counter={counter} active={active} />
    </button>
  );
}

function CounterBody({ counter, active }: { counter: Counter; active?: boolean }): ReactNode {
  return (
    <>
      <span className="flex items-center gap-2">
        <StatusDot tone={counter.tone} decorative className="size-1.5" />
        <MetricValue tone={counter.tone}>{counter.count}</MetricValue>
      </span>
      <MetricLabel active={active}>{counter.label}</MetricLabel>
    </>
  );
}
