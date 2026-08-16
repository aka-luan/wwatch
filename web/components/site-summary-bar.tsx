import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { fleetUpdateSummary, updateRequestBody } from "@/lib/fleet-updates";
import { statusFilterCounts, type SiteFilterState } from "@/lib/site-filters";
import { SITE_STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { OverviewRow } from "@/lib/types";

const COUNTER_STATUSES = ["critical", "attention", "healthy"] as const;
type CounterStatus = (typeof COUNTER_STATUSES)[number];

const COUNTER_TONE: Record<CounterStatus, string> = {
  critical: "text-destructive",
  attention: "text-warning",
  healthy: "text-success",
};

/** "N critical · N attention · N healthy" — each count is a filter, not just a phrase. */
export function SiteSummaryBar({
  sites,
  state,
  onChange,
  onChanged,
}: {
  sites: OverviewRow[];
  state: SiteFilterState;
  onChange: (next: SiteFilterState) => void;
  onChanged: () => Promise<void>;
}) {
  const counts = statusFilterCounts(sites);
  const updates = fleetUpdateSummary(sites);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(filter: CounterStatus) {
    onChange({ ...state, status: state.status === filter ? "all" : filter });
  }

  async function updateAll() {
    setBusy(true);
    const items = updates.groups
      .filter((group) => group.canUpdate && !group.running)
      .flatMap((group) => group.items);
    let failed = 0;
    for (const item of items) {
      const body = updateRequestBody(item);
      if (!body) {
        continue;
      }
      try {
        await api(`/api/sites/${item.siteId}/update`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    setConfirmOpen(false);
    if (failed === 0) {
      toast.success(`${items.length} update${items.length === 1 ? "" : "s"} applied`);
    } else {
      toast.error(`${failed} of ${items.length} updates failed`);
    }
    await onChanged();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center text-[13px]" role="group" aria-label="Fleet summary">
        {COUNTER_STATUSES.map((filter, index) => (
          <span key={filter} className="flex items-center">
            {index > 0 ? (
              <span className="mx-1 text-muted-foreground/40" aria-hidden>
                ·
              </span>
            ) : null}
            <SummaryCounter
              filter={filter}
              count={counts[filter]}
              active={state.status === filter}
              onClick={() => toggle(filter)}
            />
          </span>
        ))}
      </div>
      {updates.updateCount > 0 ? (
        <>
          <Button type="button" size="sm" onClick={() => setConfirmOpen(true)}>
            {COPY.summary.updateAll(updates.updateCount)}
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{COPY.updateAllConfirm.title(updates.updateCount)}</AlertDialogTitle>
                <AlertDialogDescription>{COPY.updateAllConfirm.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={busy} aria-busy={busy} onClick={() => void updateAll()}>
                  {busy ? <Spinner size={14} /> : null}
                  {COPY.updateAllConfirm.action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

function SummaryCounter({
  filter,
  count,
  active,
  onClick,
}: {
  filter: CounterStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${count} ${SITE_STATUS_LABEL[filter]}${count === 1 ? "" : ""}, filter`}
      onClick={onClick}
      className={cn(
        "rounded-sm px-1.5 py-1 tabular-nums transition-colors",
        "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <span className={cn("font-semibold", count > 0 ? COUNTER_TONE[filter] : undefined)}>{count}</span>{" "}
      {SITE_STATUS_LABEL[filter].toLowerCase()}
    </button>
  );
}
