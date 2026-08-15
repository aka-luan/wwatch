import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpCircleIcon,
  ExternalLinkIcon,
  HistoryIcon,
  Loader2Icon,
  ScanLineIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyNote, FindingRow, RowAction } from "@/components/finding-row";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { helperCan, isRepairablePath } from "@/lib/helper";
import { SITE_STATUS_LABEL, rollupLabel, siteStatusFromRollup, siteStatusFromSeverity } from "@/lib/status";
import type { Finding, HelperInfo, InstalledPlugin, ScanSummary, SitePage } from "@/lib/types";

export function SiteDrawer({
  open,
  page,
  onClose,
  onEdit,
  onChanged,
}: {
  open: boolean;
  page: SitePage;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const findings = page.latest?.findings ?? [];
  const plugins = page.latest?.plugins ?? [];
  const helper = page.latest?.helper ?? null;
  const canUpdate = helperCan(helper, "update");
  const updateFindings = findings.filter(
    (finding) => finding.kind === "plugin_update" || finding.kind === "theme_update",
  );
  const previous = (page.history ?? []).filter((scan) => scan.id !== page.latest?.id);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [helperError, setHelperError] = useState("");
  const [pluginChange, setPluginChange] = useState<{
    plugin: string;
    name: string;
    status: "active" | "inactive";
  } | null>(null);
  const [confirmJob, setConfirmJob] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
    action: string;
  } | null>(null);

  useEffect(() => {
    setHelperError("");
    setLoginBusy(false);
    setScanBusy(false);
  }, [page.site.id]);

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
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[520px]"
      >
        <SheetHeader className="gap-3 border-b bg-popover p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg">{page.site.name}</SheetTitle>
              <SheetDescription className="mt-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={page.site.origin}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 text-muted-foreground hover:text-foreground"
                      />
                    }
                  >
                    <span className="truncate [overflow-wrap:anywhere]">{page.site.origin}</span>
                    <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent>Open site</TooltipContent>
                </Tooltip>
              </SheetDescription>
            </div>
            <div className="actions">
              <Button
                variant="outline"
                type="button"
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
                {loginBusy ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
                Log in
              </Button>
              {canUpdate && updateFindings.length ? (
                <Button
                  variant="outline"
                  type="button"
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
                  <ArrowUpCircleIcon className="size-4" aria-hidden />
                  Update all
                </Button>
              ) : null}
              <Button
                variant="outline"
                type="button"
                disabled={scanBusy}
                aria-busy={scanBusy}
                onClick={() => {
                  void (async () => {
                    setScanBusy(true);
                    try {
                      await api(`/api/sites/${page.site.id}/scan`, { method: "POST" });
                      toast.success("Scan started");
                      await onChanged();
                    } finally {
                      setScanBusy(false);
                    }
                  })();
                }}
              >
                {scanBusy ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ScanLineIcon className="size-4" aria-hidden />
                )}
                Scan
              </Button>
              <Button variant="outline" type="button" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="outline" type="button" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={siteStatusFromRollup(page.rollup)}>{rollupLabel(page.rollup)}</StatusBadge>
            {page.latest?.coreVersion ? <span>WP {page.latest.coreVersion}</span> : null}
          </p>
          <HelperHelp helper={helper} />
          {helperError ? <p className="error">{helperError}</p> : null}
          <SectionLabel icon={<ShieldAlertIcon className="size-4" aria-hidden />}>Findings</SectionLabel>
          {findings.length ? (
            findings.map((finding) => (
              <FindingRow
                key={`${finding.kind}:${finding.title}:${finding.detail}`}
                status={siteStatusFromSeverity(finding.severity)}
                statusLabel={findingStatusLabel(finding.severity)}
                title={finding.title}
                detail={finding.detail}
                action={findingAction(finding, helper, page.site.name, setConfirmJob, applyHelper)}
              />
            ))
          ) : (
            <EmptyNote tone="positive">No findings on the last scan.</EmptyNote>
          )}
          <SectionLabel icon={<HistoryIcon className="size-4" aria-hidden />}>Previous scans</SectionLabel>
          {previous.length ? (
            previous.map((scan) => <ScanHistoryRow key={scan.id} scan={scan} />)
          ) : (
            <EmptyNote>No earlier scans.</EmptyNote>
          )}
          <SectionLabel>Plugins</SectionLabel>
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
          <div className="row-actions">
            <Button variant="destructive" type="button" onClick={() => setRemoveOpen(true)}>
              Remove site
            </Button>
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
                    onClose();
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
      </SheetContent>
    </Sheet>
  );
}

function findingStatusLabel(severity: Finding["severity"]): string {
  if (severity === "crit") {
    return SITE_STATUS_LABEL.critical;
  }
  if (severity === "warn") {
    return SITE_STATUS_LABEL.attention;
  }
  return "Info";
}

function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mt-5 mb-0 flex items-center gap-2 text-[13px] font-medium first:mt-1">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      {children}
    </h3>
  );
}

function HelperHelp({ helper }: { helper: HelperInfo | null }) {
  if (!helper || helper.kind === "missing") {
    return (
      <p className="help">
        Install the <a href="/api/helper-plugin">wwatch plugin</a> to log in, update, or fix findings from the
        board.
      </p>
    );
  }
  if (!helperCan(helper, "update")) {
    return (
      <p className="help">
        This plugin can log in. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to update or
        fix findings from the board.
      </p>
    );
  }
  if (!helperCan(helper, "repair")) {
    return (
      <p className="help">
        This plugin can log in and update. Download the current <a href="/api/helper-plugin">wwatch plugin</a>{" "}
        to fix exposed files from the board.
      </p>
    );
  }
  return <p className="help">Log in opens wp-admin. Update and Fix use the wwatch plugin on this site.</p>;
}

function findingAction(
  finding: Finding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: { title: string; description: string; run: () => Promise<void>; action: string }) => void,
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

function ScanHistoryRow({ scan }: { scan: ScanSummary }) {
  const status = siteStatusFromRollup(scan.rollup);
  return (
    <div className="-mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border-t border-border px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
      <span className="inline-flex items-center gap-2 text-foreground">
        <StatusDot status={status} decorative />
        <span>{rollupLabel(scan.rollup)}</span>
      </span>
      <span>{ago(scan.finishedAt)}</span>
      <span className="sm:ml-auto">
        {scan.counts.crit} crit · {scan.counts.warn} warn
      </span>
    </div>
  );
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
  const update = findings.find((finding) => finding.kind === "plugin_update" && finding.plugin === plugin.ref);
  const next = plugin.status === "active" ? "inactive" : "active";
  return (
    <div className="-mx-2 flex flex-wrap items-start justify-between gap-3 rounded-md border-t border-border px-2 py-3 transition-colors hover:bg-muted/40">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="font-medium [overflow-wrap:anywhere]">{plugin.name}</strong>
          <Badge
            variant="outline"
            className="h-5 px-1.5 py-0 font-mono text-[11px] font-medium tracking-wide uppercase"
          >
            {plugin.status}
          </Badge>
          {update ? <StatusBadge status="attention" /> : null}
        </div>
        <p className="mono mt-1 text-[13px] text-muted-foreground">
          {plugin.ref}
          {update ? ` · ${plugin.version} → ${update.latest}` : ` · ${plugin.version}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {canUpdate && update ? (
          <RowAction type="button" onClick={() => onUpdate({ plugin: plugin.ref, name: plugin.name })}>
            Update
          </RowAction>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => onToggle({ plugin: plugin.ref, name: plugin.name, status: next })}
        >
          Set {next}
        </Button>
      </div>
    </div>
  );
}
