import { useEffect, useRef } from "react";
import { CheckIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  PRIMARY_STATUS_FILTERS,
  SECONDARY_FILTERS,
  SECONDARY_FILTER_LABEL,
  filtersActive,
  primaryFilterLabel,
  removeSecondaryFilter,
  secondaryFilterCounts,
  statusFilterCounts,
  toggleSecondaryFilter,
  type PrimaryStatusFilter,
  type SecondaryFilter,
  type SiteFilterState,
} from "@/lib/site-filters";
import { cn } from "@/lib/utils";
import type { OverviewRow } from "@/lib/types";

export function SiteFilters({
  sites,
  state,
  onChange,
}: {
  sites: OverviewRow[];
  state: SiteFilterState;
  onChange: (next: SiteFilterState) => void;
}) {
  const counts = statusFilterCounts(sites);
  const secondaryCounts = secondaryFilterCounts(sites);
  const active = filtersActive(state);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }
      if (isTypingTarget(event.target) || isOverlayOpen()) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="site-filters" aria-label="Filter sites">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            type="search"
            value={state.query}
            onChange={(event) => onChange({ ...state, query: event.target.value })}
            placeholder="Search sites"
            aria-label="Search sites by name or domain"
            className="peer h-8 border-transparent bg-transparent pl-8 shadow-none md:pr-8 md:text-sm dark:bg-transparent"
          />
          {state.query ? null : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-sm border border-border/80 px-1 font-mono text-[11px] text-muted-foreground peer-focus:hidden md:inline-flex">
              /
            </kbd>
          )}
        </div>
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

      <div className="status-filter-scroll -mx-1 flex gap-1 overflow-x-auto px-1 py-0.5" role="group" aria-label="Fleet summary">
        {PRIMARY_STATUS_FILTERS.map((filter) => (
          <StatusFilterChip
            key={filter}
            filter={filter}
            count={counts[filter]}
            active={state.status === filter}
            onSelect={() => onChange({ ...state, status: filter })}
          />
        ))}
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

function StatusFilterChip({
  filter,
  count,
  active,
  onSelect,
}: {
  filter: PrimaryStatusFilter;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const label = primaryFilterLabel(filter);
  const countClass = countToneClass(filter, count, active);
  return (
    <Badge
      variant={active ? "secondary" : "outline"}
      render={
        <button
          type="button"
          aria-pressed={active}
          aria-label={`${label}, ${count} ${count === 1 ? "site" : "sites"}`}
          onClick={onSelect}
        />
      }
      className={cn(
        "h-7 shrink-0 cursor-pointer gap-1.5 rounded-md px-2.5 text-xs font-medium",
        active
          ? "bg-secondary text-foreground ring-1 ring-foreground/15 ring-inset"
          : "bg-transparent text-muted-foreground ring-1 ring-border/70 ring-inset hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {filter === "all" ? null : (
        <StatusDot
          status={filter}
          decorative
          className={cn("size-1.5", count === 0 && "opacity-40")}
        />
      )}
      <span>{label}</span>
      <span className={cn("tabular-nums", countClass)}>{count}</span>
    </Badge>
  );
}

function countToneClass(filter: PrimaryStatusFilter, count: number, active: boolean): string {
  if (active) {
    return "font-medium text-foreground";
  }
  if (count === 0 || filter === "all") {
    return "font-normal opacity-70";
  }
  if (filter === "critical") {
    return "font-medium text-destructive";
  }
  if (filter === "attention") {
    return "font-medium text-warning";
  }
  return "font-normal opacity-70";
}

function ActiveFilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "h-6 gap-1 rounded-md pr-1 pl-2 text-xs font-medium ring-1 ring-border/80 ring-inset",
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onRemove}
      >
        <XIcon className="size-3" aria-hidden />
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
                "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
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

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isOverlayOpen(): boolean {
  return Boolean(
    document.querySelector(
      '[data-slot="dialog-overlay"][data-open], [data-slot="sheet-overlay"][data-open], [data-slot="alert-dialog-overlay"][data-open]',
    ),
  );
}
