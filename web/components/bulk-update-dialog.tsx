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
import { updateRequestBody, type FleetUpdateSiteGroup } from "@/lib/fleet-updates";
import { skipSentence, type UpdatePlan } from "@/lib/update-plan";
import { cn } from "@/lib/utils";

/**
 * Mockup 1d: the confirm step names every item it will run and every site it will skip,
 * so nothing about a bulk update is a surprise.
 */
export function BulkUpdateDialog({
  plan,
  open,
  onOpenChange,
  onChanged,
}: {
  plan: UpdatePlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    let failed = 0;
    for (const item of plan.items) {
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
    onOpenChange(false);
    if (failed === 0) {
      toast.success(`${plan.itemCount} update${plan.itemCount === 1 ? "" : "s"} applied`);
    } else {
      toast.error(`${failed} of ${plan.itemCount} updates failed`);
    }
    await onChanged();
  }

  const skip = skipSentence(plan.skipped);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[520px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Update {plan.itemCount} item{plan.itemCount === 1 ? "" : "s"} across {plan.siteCount} site
            {plan.siteCount === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            wwatch updates each plugin and theme through the helper, then rescans. WordPress core is not
            included.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[45vh] overflow-y-auto">
          {plan.groups.map((group, index) => (
            <UpdateGroup key={group.siteId} group={group} defaultOpen={index === 0} />
          ))}
        </div>

        {skip ? (
          <p
            className="rounded-md border border-warning/30 bg-warning/[0.07] px-3.5 py-3 text-[12.5px] leading-5 text-warning"
            role="note"
          >
            {skip}
          </p>
        ) : null}

        <AlertDialogFooter className="items-center">
          <p className="mr-auto text-[12px] text-muted-foreground">
            Runs sequentially · you can watch progress per site
          </p>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || plan.itemCount === 0}
            aria-busy={busy}
            onClick={() => void run()}
          >
            {busy ? <Spinner size={14} /> : null}
            Update {plan.itemCount}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UpdateGroup({ group, defaultOpen }: { group: FleetUpdateSiteGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = `bulk-update-${group.siteId}`;

  return (
    <div className={cn("py-2.5", !defaultOpen && "border-t border-hairline")}>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold text-foreground">{group.siteName}</span>
        <span className="font-mono text-[12.5px] text-muted-foreground">
          {group.items.length} item{group.items.length === 1 ? "" : "s"}
        </span>
        {open ? null : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            aria-expanded={false}
            aria-controls={listId}
            onClick={() => setOpen(true)}
          >
            Show
          </Button>
        )}
      </div>
      {open ? (
        <ul id={listId} className="m-0 mt-1.5 list-none p-0">
          {group.items.map((item) => (
            <li key={item.key} className="font-mono text-[12.5px] leading-[1.7] text-muted-foreground">
              <span className="text-foreground">{item.title}</span>
              {item.installed && item.latest ? ` ${item.installed} → ${item.latest}` : null}
              {isMajor(item.installed, item.latest) ? (
                <span className="ml-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-warning uppercase">
                  major
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A leading-number bump is the only "major" signal the finding data actually carries. */
function isMajor(installed: string | undefined, latest: string | undefined): boolean {
  if (!installed || !latest) {
    return false;
  }
  const from = Number.parseInt(installed, 10);
  const to = Number.parseInt(latest, 10);
  return Number.isFinite(from) && Number.isFinite(to) && to > from;
}
