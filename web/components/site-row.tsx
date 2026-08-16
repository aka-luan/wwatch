import { useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon, ExternalLinkIcon, LogInIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, FindingRow, RowAction } from "@/components/finding-row";
import { ProcessingIndicator } from "@/components/processing-indicator";
import { ScanTimeline } from "@/components/scan-timeline";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { siteActionabilityGroups, type DisplayFinding } from "@/lib/finding-groups";
import { agoWords, ago, formatScanWhen, host } from "@/lib/format";
import { helperCan, isRepairablePath } from "@/lib/helper";
import { scanningLabel, scanOperationOf, type ScanOperationState } from "@/lib/scan-operation";
import { siteOverview, siteRowCopy } from "@/lib/site-overview";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Finding, HelperInfo, InstalledPlugin, SitePage } from "@/lib/types";
import type { OverviewRow } from "@/lib/types";

type ConfirmJob = {
  title: string;
  description: string;
  run: () => Promise<void>;
  action: string;
};

const BORDER_TONE: Record<SiteStatus, string> = {
  critical: "border-l-destructive",
  attention: "border-l-warning",
  healthy: "border-l-success",
  unknown: "border-l-border",
};

/** Dense row: status lives only in the left border. Click to expand in place — no drawer, no modal. */
export function SiteRow({
  row,
  expanded,
  page,
  onToggle,
  onEdit,
  onChanged,
}: {
  row: OverviewRow;
  expanded: boolean;
  page: SitePage | null;
  onToggle: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const overview = siteOverview(row);
  const operation = scanOperationOf(row);
  const copy = siteRowCopy(overview, ago, formatScanWhen);
  const scanning = operation.kind === "running";
  const panelId = `site-panel-${row.site.id}`;

  return (
    <div className={cn("border-l-[3px]", BORDER_TONE[overview.status])} style={{ borderRadius: 0 }}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${row.site.name}, ${SITE_STATUS_LABEL[overview.status]}${scanning ? ", scanning" : ""}, ${
          copy.finding ?? copy.meta
        }`}
        className={cn(
          "group flex w-full items-start gap-3 border-0 bg-transparent px-3 py-2.5 text-left",
          "cursor-pointer appearance-none transition-colors duration-150",
          "hover:bg-muted/50 active:bg-muted/70 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span className="min-w-0 truncate leading-5 font-medium text-foreground">{row.site.name}</span>
            <span className="mono host min-w-0 truncate text-[13px] sm:max-w-[45%]">{host(row.site.origin)}</span>
          </span>
          {copy.finding ? (
            <span className="mt-1 block truncate text-sm leading-5 text-foreground">{copy.finding}</span>
          ) : null}
          {scanning || copy.meta ? (
            <span className="mt-1 flex flex-col gap-0.5 text-[12px] leading-4 text-muted-foreground">
              {scanning ? <ProcessingIndicator label={`${scanningLabel(operation.stage)}…`} size={12} /> : null}
              {copy.meta ? <span>{copy.meta}</span> : null}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={panelId} className="border-t border-border/60 px-3 pb-3">
          {page && page.site.id === row.site.id ? (
            <ExpandedSitePanel page={page} onEdit={onEdit} onChanged={onChanged} />
          ) : (
            <div className="space-y-2 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ExpandedSitePanel({
  page,
  onEdit,
  onChanged,
}: {
  page: SitePage;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const findings = page.latest?.findings ?? [];
  const plugins = page.latest?.plugins ?? [];
  const helper = page.latest?.helper ?? null;
  const canUpdate = helperCan(helper, "update");
  const canLogin = helperCan(helper, "login");
  const groups = siteActionabilityGroups(findings);
  const updateItems = groups.needsAction.filter((item) => item.tone === "update");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [helperError, setHelperError] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [pluginChange, setPluginChange] = useState<{
    plugin: string;
    name: string;
    status: "active" | "inactive";
  } | null>(null);
  const [confirmJob, setConfirmJob] = useState<ConfirmJob | null>(null);
  const operation = scanOperationOf(page);
  const scanning = operation.kind === "running" || scanBusy;

  useEffect(() => {
    setHelperError("");
    setLoginBusy(false);
    setScanBusy(false);
  }, [page.site.id]);

  async function startScan() {
    setHelperError("");
    setScanBusy(true);
    try {
      await api(`/api/sites/${page.site.id}/scan`, { method: "POST" });
      toast.message("Scan started");
      await onChanged();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not start scan";
      setHelperError(text);
      toast.error(text);
    } finally {
      setScanBusy(false);
    }
  }

  async function applyHelper(path: string, body: unknown, failed: string) {
    setHelperError("");
    try {
      await api(`/api/sites/${page.site.id}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Update succeeded");
      await onChanged();
    } catch (error) {
      const text = error instanceof Error ? error.message : failed;
      setHelperError(text);
      toast.error(text);
    }
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={page.site.origin} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon />
          Open site
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={scanning}
          aria-busy={scanning}
          onClick={() => void startScan()}
        >
          {scanning ? <Spinner size={14} /> : <RefreshCwIcon />}
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
        {canLogin ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={loginBusy}
            aria-busy={loginBusy}
            onClick={() => {
              void (async () => {
                setHelperError("");
                setLoginBusy(true);
                const tab = window.open("about:blank", "wp-admin");
                try {
                  const result = await api<{ url: string }>(`/api/sites/${page.site.id}/wp-login`, {
                    method: "POST",
                  });
                  if (tab) {
                    tab.opener = null;
                    tab.location.replace(result.url);
                  } else {
                    setHelperError("The browser blocked the login window. Allow popups for this board.");
                  }
                } catch (error) {
                  tab?.close();
                  setHelperError(error instanceof Error ? error.message : "Could not log in");
                } finally {
                  setLoginBusy(false);
                }
              })();
            }}
          >
            {loginBusy ? <Spinner size={14} /> : <LogInIcon />}
            WP Admin
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" type="button" onClick={onEdit}>
          Edit credentials
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setRemoveOpen(true)}
        >
          Remove site
        </Button>
      </div>

      <ScanOperationBanner
        operation={operation}
        scanning={scanning}
        historyReady={Boolean(page.username)}
        onRetry={() => void startScan()}
        retryBusy={scanBusy}
      />

      {helperError ? (
        <p className="text-sm text-destructive" role="alert" aria-live="assertive">
          {helperError}
        </p>
      ) : null}

      {page.latest ? (
        groups.needsAction.length || groups.informational.length ? (
          <div>
            {groups.needsAction.length ? (
              <section>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{COPY.row.needsAction}</h3>
                  {canUpdate && updateItems.length ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmJob({
                          title: "Update plugins and themes?",
                          description:
                            "Update every plugin and theme that has a wordpress.org update? Core is not included.",
                          action: "Update all",
                          run: () => applyHelper("/update", { kind: "all" }, "Could not update"),
                        })
                      }
                    >
                      Update all
                    </Button>
                  ) : null}
                </div>
                {groups.needsAction.map((item) => (
                  <FindingRow
                    key={item.id}
                    status={item.status}
                    statusLabel={item.statusLabel}
                    title={item.title}
                    explanation={item.explanation}
                    detail={item.detail}
                    compact={item.compact}
                    showStatus={item.showStatus}
                    tone={item.tone}
                    action={rowAction(item, helper, page.site.name, setConfirmJob, applyHelper)}
                  />
                ))}
              </section>
            ) : null}
            {groups.informational.length ? (
              <Collapsible open={infoOpen} onOpenChange={setInfoOpen} className={groups.needsAction.length ? "mt-3" : undefined}>
                <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <span>{COPY.row.informational(groups.informational.length)}</span>
                  <ChevronDownIcon
                    className="size-4 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {groups.informational.map((item) => (
                    <FindingRow
                      key={item.id}
                      status={item.status}
                      statusLabel={item.statusLabel}
                      title={item.title}
                      explanation={item.explanation}
                      detail={item.detail}
                      compact={item.compact}
                      showStatus={item.showStatus}
                      tone={item.tone}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : (
          <EmptyNote tone="positive">{COPY.row.noAction}</EmptyNote>
        )
      ) : scanning ? null : (
        <p className="text-sm text-muted-foreground">{COPY.row.notScannedYet}</p>
      )}

      <HelperHelp helper={helper} />

      <Separator />
      <Collapsible>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm font-medium hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {COPY.row.scanHistory}
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-2">
          <ScanTimeline page={page} />
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm font-medium hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {COPY.row.siteConfiguration}
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-2">
          {plugins.length ? (
            plugins.map((plugin) => (
              <PluginRow
                key={plugin.ref}
                plugin={plugin}
                findings={findings}
                canUpdate={canUpdate}
                onToggle={(next) => setPluginChange(next)}
                onUpdate={(next) =>
                  setConfirmJob({
                    title: `Update ${next.name}?`,
                    description: `Update ${next.name} on ${page.site.name}?`,
                    action: "Update",
                    run: () =>
                      applyHelper("/update", { kind: "plugin", plugin: next.plugin }, "Could not update"),
                  })
                }
              />
            ))
          ) : (
            <EmptyNote>No plugin list yet. Scan with a working Application Password.</EmptyNote>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {page.site.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The site is removed from this board. WordPress itself is not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void (async () => {
                  await api(`/api/sites/${page.site.id}`, { method: "DELETE" });
                  setRemoveOpen(false);
                  await onChanged();
                })();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(pluginChange)} onOpenChange={(next) => !next && setPluginChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set {pluginChange?.name} to {pluginChange?.status}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This changes the plugin on the WordPress site, then starts a new scan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pluginChange) {
                  return;
                }
                void (async () => {
                  try {
                    await api(`/api/sites/${page.site.id}/plugins`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        plugin: pluginChange.plugin,
                        status: pluginChange.status,
                      }),
                    });
                    await api(`/api/sites/${page.site.id}/scan`, { method: "POST" });
                    toast.success("Update succeeded");
                    await onChanged();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Update failed");
                  }
                })();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    </div>
  );
}

function ScanOperationBanner({
  operation,
  scanning,
  historyReady,
  onRetry,
  retryBusy,
}: {
  operation: ScanOperationState;
  scanning: boolean;
  historyReady: boolean;
  onRetry: () => void;
  retryBusy: boolean;
}) {
  if (scanning || operation.kind === "running") {
    const stage = operation.kind === "running" ? operation.stage : null;
    const showingFrom = operation.kind === "running" ? operation.showingFrom : null;
    return (
      <div className="space-y-0.5" aria-live="polite">
        <ProcessingIndicator label={`${scanningLabel(stage)}…`} />
        {showingFrom ? (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Showing results from {formatScanWhen(showingFrom)}
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">Waiting for the first result.</p>
        )}
      </div>
    );
  }

  if (operation.kind !== "failed") {
    return null;
  }

  const lastSuccessfulCopy = operation.lastSuccessfulAt
    ? `Last successful result from ${agoWords(operation.lastSuccessfulAt)}.`
    : historyReady
      ? "No earlier successful result yet."
      : null;

  return (
    <div className="space-y-1" aria-live="polite">
      <p className="text-sm font-medium text-destructive">Scan failed</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lastSuccessfulCopy ? (
          <p className="min-w-0 text-[13px] leading-5 text-muted-foreground">{lastSuccessfulCopy}</p>
        ) : (
          <span className="min-w-0" />
        )}
        <Button variant="outline" size="xs" type="button" disabled={retryBusy} aria-busy={retryBusy} onClick={onRetry}>
          {retryBusy ? <Spinner size={12} /> : null}
          Retry
        </Button>
      </div>
      {operation.detail ? (
        <p className="text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{operation.detail}</p>
      ) : null}
    </div>
  );
}

function HelperHelp({ helper }: { helper: HelperInfo | null }) {
  if (!helper || helper.kind === "missing") {
    return (
      <p className="text-sm text-muted-foreground">
        Install the <a href="/api/helper-plugin">wwatch plugin</a> to open WP Admin, update, or fix findings from
        the board.
      </p>
    );
  }
  if (!helperCan(helper, "update")) {
    return (
      <p className="text-sm text-muted-foreground">
        This plugin can log in. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to update or
        fix findings from the board.
      </p>
    );
  }
  if (!helperCan(helper, "repair")) {
    return (
      <p className="text-sm text-muted-foreground">
        This plugin can log in and update. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to
        fix exposed files from the board.
      </p>
    );
  }
  return null;
}

function rowAction(
  item: DisplayFinding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: ConfirmJob) => void,
  applyHelper: (path: string, body: unknown, failed: string) => Promise<void>,
): ReactNode {
  if (item.findings.length !== 1) {
    return undefined;
  }
  const finding = item.findings[0];
  if (!finding) {
    return undefined;
  }
  return findingAction(finding, helper, siteName, confirm, applyHelper);
}

function findingAction(
  finding: Finding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: ConfirmJob) => void,
  applyHelper: (path: string, body: unknown, failed: string) => Promise<void>,
) {
  if (helperCan(helper, "update")) {
    if (finding.kind === "plugin_update" && finding.plugin) {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Update ${finding.title}?`,
              description: `Update ${finding.title} on ${siteName}?`,
              action: "Update",
              run: () => applyHelper("/update", { kind: "plugin", plugin: finding.plugin }, "Could not update"),
            })
          }
        >
          Update
        </RowAction>
      );
    }
    if (finding.kind === "theme_update" && finding.theme) {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Update ${finding.title}?`,
              description: `Update ${finding.title} on ${siteName}?`,
              action: "Update",
              run: () => applyHelper("/update", { kind: "theme", theme: finding.theme }, "Could not update"),
            })
          }
        >
          Update
        </RowAction>
      );
    }
    if (finding.kind === "core_update") {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Update WordPress on ${siteName}?`,
              description: `Update WordPress to a new version on ${siteName}? Back up first if you have not.`,
              action: "Update",
              run: () => applyHelper("/update", { kind: "core" }, "Could not update"),
            })
          }
        >
          Update
        </RowAction>
      );
    }
  }
  if (helperCan(helper, "repair")) {
    if (finding.kind === "xmlrpc_open") {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Disable XML-RPC on ${siteName}?`,
              description: `Disable XML-RPC on ${siteName}? This does not delete xmlrpc.php.`,
              action: "Fix",
              run: () => applyHelper("/repair", { kind: "xmlrpc" }, "Could not repair"),
            })
          }
        >
          Fix
        </RowAction>
      );
    }
    if (finding.kind === "exposed_path" && isRepairablePath(finding.path)) {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Delete ${finding.path}?`,
              description: `Delete ${finding.path} on ${siteName}?`,
              action: "Fix",
              run: () => applyHelper("/repair", { kind: "exposed_path", path: finding.path }, "Could not repair"),
            })
          }
        >
          Fix
        </RowAction>
      );
    }
  }
  return undefined;
}

function PluginRow({
  plugin,
  findings,
  canUpdate,
  onToggle,
  onUpdate,
}: {
  plugin: InstalledPlugin;
  findings: Finding[];
  canUpdate: boolean;
  onToggle: (next: { plugin: string; name: string; status: "active" | "inactive" }) => void;
  onUpdate: (next: { plugin: string; name: string }) => void;
}) {
  const update = findings.find((item) => item.kind === "plugin_update" && item.plugin === plugin.ref);
  const next = plugin.status === "active" ? "inactive" : "active";
  return (
    <div className="flex flex-col gap-2 border-t border-border py-2.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="[overflow-wrap:anywhere]">
          <strong>{plugin.name}</strong>{" "}
          <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono text-[11px] font-medium tracking-wide uppercase">
            {plugin.status}
          </Badge>
          {update ? (
            <>
              {" "}
              <StatusBadge status="attention" /> {plugin.version} → {update.latest}
            </>
          ) : (
            <span className="mono"> {plugin.version}</span>
          )}
        </p>
        <p className="mono text-[12px] text-muted-foreground">{plugin.ref}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canUpdate && update ? (
          <RowAction type="button" onClick={() => onUpdate({ plugin: plugin.ref, name: plugin.name })}>
            Update
          </RowAction>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onToggle({ plugin: plugin.ref, name: plugin.name, status: next })}
        >
          Set {next}
        </Button>
      </div>
    </div>
  );
}
