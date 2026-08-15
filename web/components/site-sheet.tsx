import { useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon, ExternalLinkIcon, LogInIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, FindingRow, RowAction } from "@/components/finding-row";
import { ProcessingIndicator } from "@/components/processing-indicator";
import { ScanTimeline } from "@/components/scan-timeline";
import { StatusBadge } from "@/components/status-badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { siteFindingSections, type DisplayFinding } from "@/lib/finding-groups";
import { agoWords, formatScanWhen, host } from "@/lib/format";
import { helperCan, isRepairablePath } from "@/lib/helper";
import { scanningLabel, scanOperationOf, type ScanOperationState } from "@/lib/scan-operation";
import { siteOverview } from "@/lib/site-overview";
import { SITE_STATUS_LABEL } from "@/lib/status";
import type { Finding, HelperInfo, InstalledPlugin, SitePage } from "@/lib/types";

type ConfirmJob = {
  title: string;
  description: string;
  run: () => Promise<void>;
  action: string;
};

export function SiteSheet({
  open,
  page,
  onOpenChange,
  onEdit,
  onChanged,
}: {
  open: boolean;
  page: SitePage | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="h-full w-full! gap-0 overflow-hidden p-0 data-[side=right]:w-full! data-[side=right]:max-w-none sm:data-[side=right]:max-w-lg"
        >
        {page ? (
          <SiteActionCenter page={page} onOpenChange={onOpenChange} onEdit={onEdit} onChanged={onChanged} />
        ) : (
          <div className="space-y-3 p-4 pt-12">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SiteActionCenter({
  page,
  onOpenChange,
  onEdit,
  onChanged,
}: {
  page: SitePage;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const findings = page.latest?.findings ?? [];
  const plugins = page.latest?.plugins ?? [];
  const helper = page.latest?.helper ?? null;
  const canUpdate = helperCan(helper, "update");
  const canLogin = helperCan(helper, "login");
  const updateFindings = findings.filter(
    (finding) => finding.kind === "plugin_update" || finding.kind === "theme_update",
  );
  const overview = siteOverview(page);
  const sections = siteFindingSections({
    origin: page.site.origin,
    findings,
    scanned: Boolean(page.latest),
  });
  const [removeOpen, setRemoveOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [helperError, setHelperError] = useState("");
  const [pluginChange, setPluginChange] = useState<{
    plugin: string;
    name: string;
    status: "active" | "inactive";
  } | null>(null);
  const [confirmJob, setConfirmJob] = useState<ConfirmJob | null>(null);
  const [brokenLinks, setBrokenLinks] = useState<Finding[] | null>(null);
  const operation = scanOperationOf(page);
  const scanning = operation.kind === "running" || scanBusy;

  useEffect(() => {
    setHelperError("");
    setLoginBusy(false);
    setScanBusy(false);
  }, [page.site.id]);

  async function startScan(successToast = "Scan started") {
    setHelperError("");
    setScanBusy(true);
    try {
      await api(`/api/sites/${page.site.id}/scan`, { method: "POST" });
      toast.success(successToast);
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
    <>
      <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="shrink-0 space-y-3 border-b border-border pr-12 pt-[max(1rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))]">
        <div className="min-w-0">
          <SheetTitle className="text-lg [overflow-wrap:anywhere]">{page.site.name}</SheetTitle>
          <SheetDescription className="font-mono text-[13px] [overflow-wrap:anywhere]">
            {host(page.site.origin)}
          </SheetDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={overview.status}>{SITE_STATUS_LABEL[overview.status]}</StatusBadge>
          {page.latest?.coreVersion ? (
            <span className="text-[13px] text-muted-foreground">WP {page.latest.coreVersion}</span>
          ) : null}
        </div>
        <ScanOperationBanner
          operation={operation}
          scanning={scanning}
          historyReady={Boolean(page.username)}
          onRetry={() => {
            void startScan("Scan started");
          }}
          retryBusy={scanBusy}
        />
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
          {canLogin ? (
            <Button
              variant="outline"
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
          <Button
            variant="outline"
            size="sm"
            disabled={scanning}
            aria-busy={scanning}
            onClick={() => {
              void startScan();
            }}
          >
            {scanning ? <Spinner size={14} /> : <RefreshCwIcon />}
            {scanning ? "Scanning…" : "Scan now"}
          </Button>
        </div>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <HelperHelp helper={helper} />
        {helperError ? (
          <p className="error" role="alert" aria-live="assertive">
            {helperError}
          </p>
        ) : null}
        {page.latest ? (
          sections.length ? (
            sections.map((section, index) => (
              <section key={section.id} className="pt-4">
                {index > 0 ? <Separator className="mb-4" /> : null}
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{section.label}</h3>
                  {section.id === "updates" && canUpdate && updateFindings.length ? (
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
                {section.items.map((item) => (
                  <FindingRow
                    key={item.id}
                    status={item.status}
                    statusLabel={item.statusLabel}
                    title={item.title}
                    detail={item.detail}
                    compact={item.compact}
                    showStatus={item.showStatus}
                    action={rowAction(item, helper, page.site.name, setConfirmJob, applyHelper, setBrokenLinks)}
                  />
                ))}
              </section>
            ))
          ) : (
            <EmptyNote tone="positive">No action required on the last scan.</EmptyNote>
          )
        ) : scanning ? null : (
          <p className="help pt-4">{overview.primaryLabel}.</p>
        )}
        <Separator className="my-4" />
        <section className="border-b border-border pb-3" aria-labelledby="scan-history-heading">
          <h3 id="scan-history-heading" className="mb-2 text-sm font-medium">
            Scan history
          </h3>
          <ScanTimeline page={page} />
        </section>
        <SecondaryBlock title="Site configuration">
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
        </SecondaryBlock>
        <SecondaryBlock title="Settings">
          <p className="mb-3 font-mono text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            {page.site.origin}
          </p>
          {page.username ? (
            <p className="mb-3 text-sm text-muted-foreground">Signed in as {page.username}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" size="sm" onClick={onEdit}>
              Edit credentials
            </Button>
            <Button variant="destructive" type="button" size="sm" onClick={() => setRemoveOpen(true)}>
              Remove site
            </Button>
          </div>
        </SecondaryBlock>
      </div>
      </div>
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
                  onOpenChange(false);
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
      <Dialog open={Boolean(brokenLinks)} onOpenChange={(next) => !next && setBrokenLinks(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Broken links</DialogTitle>
            <DialogDescription>Same-origin links from the homepage that did not return 200.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {(brokenLinks ?? []).map((link) => (
              <li key={link.url ?? link.detail} className="text-sm [overflow-wrap:anywhere]">
                <a href={link.url ?? link.detail} target="_blank" rel="noreferrer">
                  {link.url ?? link.detail}
                </a>
                {link.httpStatus ? (
                  <span className="ml-2 font-mono text-[12px] text-muted-foreground">{link.httpStatus}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SecondaryBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible className="border-b border-border py-1">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-2 text-left text-sm font-medium hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {title}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">{children}</CollapsibleContent>
    </Collapsible>
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
        ) : null}
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
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled={retryBusy}
          aria-busy={retryBusy}
          onClick={onRetry}
        >
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
      <p className="help pt-4">
        Install the <a href="/api/helper-plugin">wwatch plugin</a> to open WP Admin, update, or fix findings from
        the board.
      </p>
    );
  }
  if (!helperCan(helper, "update")) {
    return (
      <p className="help pt-4">
        This plugin can log in. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to update or
        fix findings from the board.
      </p>
    );
  }
  if (!helperCan(helper, "repair")) {
    return (
      <p className="help pt-4">
        This plugin can log in and update. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to
        fix exposed files from the board.
      </p>
    );
  }
  return <p className="help pt-4">WP Admin opens wp-admin. Update and Fix use the wwatch plugin on this site.</p>;
}

function rowAction(
  item: DisplayFinding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: ConfirmJob) => void,
  applyHelper: (path: string, body: unknown, failed: string) => Promise<void>,
  onViewLinks: (links: Finding[]) => void,
): ReactNode {
  if (item.findings.length > 1 && item.findings.every((finding) => finding.kind === "broken_link")) {
    return (
      <RowAction type="button" onClick={() => onViewLinks(item.findings)}>
        View links
      </RowAction>
    );
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
          <Badge
            variant="outline"
            className="h-5 px-1.5 py-0 font-mono text-[11px] font-medium tracking-wide uppercase"
          >
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
