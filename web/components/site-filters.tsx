import { CheckIcon, ListFilterIcon, XIcon } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  SECONDARY_FILTERS,
  SECONDARY_FILTER_LABEL,
  filtersActive,
  removeSecondaryFilter,
  secondaryFilterCounts,
  toggleSecondaryFilter,
  type SecondaryFilter,
  type SiteFilterState,
} from "@/lib/site-filters";
import { cn } from "@/lib/utils";
import type { OverviewRow } from "@/lib/types";

/** Search + secondary (kind-of-problem) filters. The status summary/filter lives in FleetStatStrip. */
export function SiteFilters({
  sites,
  state,
  onChange,
}: {
  sites: readonly OverviewRow[];
  state: SiteFilterState;
  onChange: (next: SiteFilterState) => void;
}) {
  const secondaryCounts = secondaryFilterCounts(sites);
  const active = filtersActive(state);

  return (
    <section className="site-filters" aria-label="Filter sites">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-1.5">
        <SearchInput
          value={state.query}
          onValueChange={(query) => onChange({ ...state, query })}
          placeholder="Search sites"
          label="Search sites by name or domain"
        />
        <SecondaryFiltersPopover
          selected={state.secondary}
          counts={secondaryCounts}
          onToggle={(filter) =>
            onChange({
              ...state,
              secondary: toggleSecondaryFilter(state.secondary, filter),
            })
          }
        />
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            onClick={() => onChange({ query: "", status: "all", secondary: [] })}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {state.secondary.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {state.secondary.map((filter) => (
            <ActiveFilterBadge
              key={filter}
              label={SECONDARY_FILTER_LABEL[filter]}
              onRemove={() =>
                onChange({
                  ...state,
                  secondary: removeSecondaryFilter(state.secondary, filter),
                })
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ActiveFilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "h-6 gap-1 rounded-full pr-1 pl-2.5 text-xs font-medium",
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        className="-m-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onRemove}
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

function SecondaryFiltersPopover({
  selected,
  counts,
  onToggle,
}: {
  selected: readonly SecondaryFilter[];
  counts: Record<SecondaryFilter, number>;
  onToggle: (filter: SecondaryFilter) => void;
}) {
  const selectedCount = selected.length;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            aria-label={
              selectedCount > 0 ? `More filters, ${selectedCount} selected` : "More filters"
            }
          />
        }
      >
        <ListFilterIcon className="size-3.5" aria-hidden />
        Filters
        {selectedCount > 0 ? (
          <span className="tabular-nums text-muted-foreground">{selectedCount}</span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 gap-1 p-1.5">
        <PopoverHeader className="px-2 py-1.5">
          <PopoverTitle className="text-xs font-medium text-muted-foreground">Quick filters</PopoverTitle>
        </PopoverHeader>
        {SECONDARY_FILTERS.map((filter) => {
          const isOn = selected.includes(filter);
          return (
            <button
              key={filter}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isOn}
              className={cn(
                "flex w-full min-h-9 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm",
                "hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isOn && "bg-muted/50",
              )}
              onClick={() => onToggle(filter)}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-sm border",
                    isOn ? "border-foreground bg-foreground text-background" : "border-border",
                  )}
                  aria-hidden
                >
                  {isOn ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
                </span>
                {SECONDARY_FILTER_LABEL[filter]}
              </span>
              <span className="tabular-nums text-xs text-muted-foreground">{counts[filter]}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

