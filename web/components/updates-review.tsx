import { useEffect, useMemo, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ProcessingIndicator } from "@/components/processing-indicator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
  fleetUpdateSummary,
  updateRequestBody,
  type FleetUpdateItem,
  type FleetUpdateSiteGroup,
  type FleetUpdateSummary,
} from "@/lib/fleet-updates";
import type { OverviewRow } from "@/lib/types";
type ItemPhase = "pending" | "updating" | "success" | "failed";

type ItemState = {
  phase: ItemPhase;
  error?: string;
  snapshot: FleetUpdateItem;
};

type ConfirmJob = {
  title: string;
  description: string;
  action: string;
  run: () => Promise<void>;
};

export function UpdatesEntry({
  summary,
  onReview,
}: {
  summary: FleetUpdateSummary;
  onReview: () => void;
}) {
  if (summary.updateCount === 0) {
    return null;
  }
  const updatesLabel = summary.updateCount === 1 ? "update" : "updates";
  const sitesLabel = summary.siteCount === 1 ? "site" : "sites";
  const summaryText = `${summary.updateCount} ${updatesLabel} available across ${summary.siteCount} ${sitesLabel}`;
  return (
    <button
      type="button"
      className="updates-entry"
      aria-label={`Review updates: ${summaryText}`}
      onClick={onReview}
    >
      <span>
        <b>{summary.updateCount}</b> {updatesLabel} available across <b>{summary.siteCount}</b>{" "}
        {sitesLabel}
      </span>
      <span className="updates-entry-action">Review updates</span>
    </button>
  );
}

export function UpdatesReviewDialog({
  open,
  onOpenChange,
  sites,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: OverviewRow[];
  onChanged: () => Promise<void>;
}) {
  const live = useMemo(() => fleetUpdateSummary(sites), [sites]);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [confirmJob, setConfirmJob] = useState<ConfirmJob | null>(null);

  useEffect(() => {
    if (!open) {
      setItemStates({});
      setConfirmJob(null);
    }
  }, [open]);

  const groups = useMemo(() => mergeReviewGroups(live, itemStates), [live, itemStates]);

  function markItems(items: FleetUpdateItem[], phase: ItemPhase, error?: string) {
    setItemStates((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.key] = {
          phase,
          error: phase === "failed" ? error : undefined,
          snapshot: item,
        };
      }
      return next;
    });
  }

  async function runUpdate(items: FleetUpdateItem[], body: unknown, successToast: string) {
    if (!items.length) {
      return;
    }
    const siteId = items[0]?.siteId;
    if (!siteId) {
      return;
    }
    markItems(items, "updating");
    try {
      await api(`/api/sites/${siteId}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      markItems(items, "success");
      toast.success(successToast);
      await onChanged();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not update";
      markItems(items, "failed", text);
      toast.error(text);
    }
  }

  const summaryLine =
    live.updateCount === 0
      ? "No pending updates from the latest scans."
      : `${live.updateCount} update${live.updateCount === 1 ? "" : "s"} across ${live.siteCount} site${live.siteCount === 1 ? "" : "s"}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(40rem,90dvh)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 text-left">
            <DialogTitle>Updates</DialogTitle>
            <DialogDescription>{summaryLine}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
            {groups.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Nothing left to review.</p>
            ) : (
              groups.map((group) => (
                <SiteUpdateGroup
                  key={group.siteId}
                  group={group}
                  itemStates={itemStates}
                  onConfirm={setConfirmJob}
                  onUpdateItem={(item) => {
                    const body = updateRequestBody(item);
                    if (!body) {
                      toast.error("This update target is incomplete.");
                      return;
                    }
                    void runUpdate([item], body, `${item.title} updated`);
                  }}
                  onUpdatePluginsThemes={(siteItems) => {
                    void runUpdate(siteItems, { kind: "all" }, "Plugins and themes updated");
                  }}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(confirmJob)} onOpenChange={(next) => !next && setConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmJob?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmJob?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const job = confirmJob;
                if (!job) {
                  return;
                }
                void job.run();
              }}
            >
              {confirmJob?.action ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SiteUpdateGroup({
  group,
  itemStates,
  onConfirm,
  onUpdateItem,
  onUpdatePluginsThemes,
}: {
  group: ReviewSiteGroup;
  itemStates: Record<string, ItemState>;
  onConfirm: (job: ConfirmJob) => void;
  onUpdateItem: (item: FleetUpdateItem) => void;
  onUpdatePluginsThemes: (items: FleetUpdateItem[]) => void;
}) {
  const pluginThemeItems = group.items.filter((item) => {
    if (item.kind !== "plugin" && item.kind !== "theme") {
      return false;
    }
    return phaseOf(itemStates, item.key) !== "success";
  });
  const siteBusy = group.items.some((item) => phaseOf(itemStates, item.key) === "updating");
  const actionsEnabled = group.canUpdate && !group.running && !siteBusy;

  return (
    <section className="border-b border-border py-3 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">
          {group.siteName}
        </h3>
        {group.canUpdate && pluginThemeItems.length > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            type="button"
            className="h-6 px-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            disabled={!actionsEnabled}
            onClick={() =>
              onConfirm({
                title: `Update plugins and themes on ${group.siteName}?`,
                description:
                  "Update every plugin and theme that has a wordpress.org update? Core is not included.",
                action: "Update plugins & themes",
                run: async () => onUpdatePluginsThemes(pluginThemeItems),
              })
            }
          >
            Update all
          </Button>
        ) : null}
      </div>
      {!group.canUpdate ? (
        <p className="mb-1.5 text-[12px] leading-4 text-muted-foreground">
          {group.helperMissing
            ? "Install the wwatch plugin to update from the board."
            : "This plugin build cannot update from the board."}
        </p>
      ) : group.running ? (
        <p className="mb-1.5 text-[12px] leading-4 text-muted-foreground">
          Scan in progress. Wait before updating.
        </p>
      ) : null}
      <ul className="m-0 list-none p-0">
        {group.items.map((item) => (
          <UpdateItemRow
            key={item.key}
            item={item}
            phase={phaseOf(itemStates, item.key)}
            error={itemStates[item.key]?.error}
            actionsEnabled={actionsEnabled}
            onConfirm={onConfirm}
            onUpdate={() => onUpdateItem(item)}
          />
        ))}
      </ul>
    </section>
  );
}

function UpdateItemRow({
  item,
  phase,
  error,
  actionsEnabled,
  onConfirm,
  onUpdate,
}: {
  item: FleetUpdateItem;
  phase: ItemPhase;
  error?: string;
  actionsEnabled: boolean;
  onConfirm: (job: ConfirmJob) => void;
  onUpdate: () => void;
}) {
  const label = item.kind === "core" ? "WordPress" : item.title;
  const versions =
    item.installed && item.latest ? (
      <span className="font-mono text-[12px] leading-4 tabular-nums text-muted-foreground whitespace-nowrap">
        <span className="text-muted-foreground/80">{item.installed}</span>
        <span className="mx-1 text-muted-foreground/50">→</span>
        <span className="text-foreground/80">{item.latest}</span>
      </span>
    ) : item.detail ? (
      <span className="font-mono text-[12px] leading-4 tabular-nums text-muted-foreground whitespace-nowrap">
        {item.detail}
      </span>
    ) : null;

  if (phase === "updating") {
    return (
      <li className="py-1.5">
        <ProcessingIndicator label={`Updating ${label}…`} size={12} />
      </li>
    );
  }

  if (phase === "success") {
    return (
      <li className="flex items-center gap-1.5 py-1.5 text-[13px] leading-4 text-muted-foreground">
        <CheckIcon className="size-3.5 shrink-0 text-success" aria-hidden />
        <span className="min-w-0 truncate">
          <span className="text-foreground">{label}</span> updated
        </span>
      </li>
    );
  }

  if (phase === "failed") {
    return (
      <li className="flex items-start justify-between gap-2 py-1.5">
        <div className="flex min-w-0 items-start gap-1.5 text-[13px] leading-4">
          <XIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-foreground [overflow-wrap:anywhere]">{label} failed</p>
            {error ? (
              <p className="text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="xs"
          type="button"
          className="self-end"
          disabled={!actionsEnabled}
          onClick={onUpdate}
        >
          Retry
        </Button>
      </li>
    );
  }

  return (
    <li className="group/row flex items-baseline justify-between gap-2 py-1.5">
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
        <span className="truncate text-[13px] leading-4 text-foreground">{label}</span>
        {versions}
      </div>
      {actionsEnabled ? (
        <Button
          variant="ghost"
          size="xs"
          type="button"
          className="h-6 shrink-0 px-1.5 text-[12px] text-muted-foreground opacity-80 hover:text-foreground group-hover/row:opacity-100"
          onClick={() =>
            onConfirm({
              title: item.kind === "core" ? `Update WordPress on ${item.siteName}?` : `Update ${label}?`,
              description:
                item.kind === "core"
                  ? `Update WordPress to a new version on ${item.siteName}? Back up first if you have not.`
                  : `Update ${label} on ${item.siteName}?`,
              action: "Update",
              run: async () => onUpdate(),
            })
          }
        >
          Update
        </Button>
      ) : null}
    </li>
  );
}

type ReviewSiteGroup = FleetUpdateSiteGroup & {
  items: FleetUpdateItem[];
};

function phaseOf(states: Record<string, ItemState>, key: string): ItemPhase {
  return states[key]?.phase ?? "pending";
}

function mergeReviewGroups(
  live: FleetUpdateSummary,
  itemStates: Record<string, ItemState>,
): ReviewSiteGroup[] {
  const bySite = new Map<string, ReviewSiteGroup>();

  for (const group of live.groups) {
    bySite.set(group.siteId, {
      ...group,
      items: [...group.items],
    });
  }

  for (const state of Object.values(itemStates)) {
    if (state.phase !== "success" && state.phase !== "failed" && state.phase !== "updating") {
      continue;
    }
    const item = state.snapshot;
    let group = bySite.get(item.siteId);
    if (!group) {
      group = {
        siteId: item.siteId,
        siteName: item.siteName,
        canUpdate: true,
        running: false,
        helperMissing: false,
        items: [],
        pluginThemeCount: 0,
        hasCore: false,
      };
      bySite.set(item.siteId, group);
    }
    if (!group.items.some((existing) => existing.key === item.key)) {
      group.items.push(item);
    }
  }

  return [...bySite.values()]
    .map((group) => {
      const items = [...group.items].sort((a, b) => {
        const phaseRank = (key: string) => {
          const phase = phaseOf(itemStates, key);
          if (phase === "updating") {
            return 0;
          }
          if (phase === "failed") {
            return 1;
          }
          if (phase === "pending") {
            return 2;
          }
          return 3;
        };
        const byPhase = phaseRank(a.key) - phaseRank(b.key);
        if (byPhase !== 0) {
          return byPhase;
        }
        const kindRank = (kind: FleetUpdateItem["kind"]) =>
          kind === "core" ? 0 : kind === "plugin" ? 1 : 2;
        return kindRank(a.kind) - kindRank(b.kind) || a.title.localeCompare(b.title);
      });
      return {
        ...group,
        items,
        pluginThemeCount: items.filter((item) => item.kind === "plugin" || item.kind === "theme").length,
        hasCore: items.some((item) => item.kind === "core"),
      };
    })
    .sort((a, b) => a.siteName.localeCompare(b.siteName) || a.siteId.localeCompare(b.siteId));
}
