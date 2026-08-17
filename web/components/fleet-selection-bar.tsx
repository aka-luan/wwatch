import { useState } from "react";
import { toast } from "sonner";
import { BulkUpdateDialog } from "@/components/bulk-update-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { selectionWarning, updatePlan } from "@/lib/update-plan";
import type { OverviewRow } from "@/lib/types";

/**
 * Mockup 1a's sticky bar. Selection lives in the table; this bar states what is selected,
 * warns about sites that can't update, and offers exactly one filled primary action.
 */
export function FleetSelectionBar({
  sites,
  selectedIds,
  onClear,
  onChanged,
}: {
  sites: readonly OverviewRow[];
  selectedIds: ReadonlySet<string>;
  onClear: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  if (selectedIds.size === 0) {
    return null;
  }

  const plan = updatePlan(sites, selectedIds);
  const warning = selectionWarning(plan);

  async function scanSelected() {
    setScanBusy(true);
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await api(`/api/sites/${id}/scan`, { method: "POST" });
      } catch {
        failed += 1;
      }
    }
    setScanBusy(false);
    if (failed > 0) {
      toast.error(`${failed} scan${failed === 1 ? "" : "s"} could not be started`);
    }
    await onChanged();
  }

  return (
    <div
      className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-secondary px-5 py-3"
      role="region"
      aria-label="Selected sites"
    >
      <Checkbox checked disabled aria-hidden />
      <p className="text-[13px] text-foreground">
        <strong className="font-semibold">
          {selectedIds.size} site{selectedIds.size === 1 ? "" : "s"}
        </strong>{" "}
        selected · {plan.itemCount} pending update{plan.itemCount === 1 ? "" : "s"}
      </p>
      {warning ? (
        <p className="basis-full text-[12.5px] text-warning" role="note">
          {warning}
        </p>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={scanBusy}
          aria-busy={scanBusy}
          onClick={() => void scanSelected()}
        >
          Scan {selectedIds.size}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={plan.itemCount === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Review {plan.itemCount} update{plan.itemCount === 1 ? "" : "s"}
        </Button>
      </div>
      <BulkUpdateDialog
        plan={plan}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onChanged={onChanged}
      />
    </div>
  );
}
