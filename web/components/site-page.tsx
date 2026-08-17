import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LogInIcon,
  RefreshCwIcon,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyNote, FindingRow } from "@/components/finding-row";
import { ScanTimeline } from "@/components/scan-timeline";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  HelperHelp,
  PluginRow,
  ScanOperationBanner,
  rowAction,
  type ConfirmJob,
} from "@/components/site-detail";
import { api } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { siteActionabilityGroups, type DisplayFinding } from "@/lib/finding-groups";
import { tlsDaysLeftOf } from "@/lib/fleet-table";
import { ago, host } from "@/lib/format";
import { helperCan } from "@/lib/helper";
import { scanOperationOf } from "@/lib/scan-operation";
import { effectiveStatus } from "@/lib/site-status";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/status";
import { TONE_ACCENT, TONE_SURFACE, toneOf } from "@/lib/tone";
import type { SitePage as SitePageData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Mockup 1c: the site as its own page. Findings lead, the plugin list moves behind a tab,
 * and what the board actually knows about the install sits in a rail on the right.
 */
export function SitePage({
  page,
  onBack,
  onEdit,
  onChanged,
}: {
  page: SitePageData | null;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!page) {
    return (
      <div className="space-y-3 px-(--gutter) py-6" aria-hidden>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  return <SitePageBody key={page.site.id} page={page} onBack={onBack} onEdit={onEdit} onChanged={onChanged} />;
}

function SitePageBody({
  page,
  onBack,
  onEdit,
  onChanged,
}: {
  page: SitePageData;
  onBack: () => void;
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
  const issueItems = groups.needsAction.filter((item) => item.tone !== "update");
  const status = effectiveStatus(page);
  const operation = scanOperationOf(page);

  const [scanBusy, setScanBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [helperError, setHelperError] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmJob, setConfirmJob] = useState<ConfirmJob | null>(null);
  const [pluginChange, setPluginChange] = useState<{
    plugin: string;
    name: string;
    status: "active" | "inactive";
  } | null>(null);

  const scanning = operation.kind === "running" || scanBusy;

  useEffect(() => {
    setHelperError("");
    setScanBusy(false);
    setLoginBusy(false);
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

  function openWpAdmin() {
    void (async () => {
      setHelperError("");
      setLoginBusy(true);
      const tab = window.open("about:blank", "wp-admin");
      try {
        const result = await api<{ url: string }>(`/api/sites/${page.site.id}/wp-login`, { method: "POST" });
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
  }

  return (
    <div>
      <div className="px-(--gutter) pt-3">
        <Button type="button" variant="ghost" size="xs" className="-ml-2 text-muted-foreground" onClick={onBack}>
          <ArrowLeftIcon />
          Fleet
        </Button>
      </div>

      <header className="flex flex-wrap items-start gap-x-4 gap-y-2.5 px-(--gutter) pt-1.5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <SectionHeading
              level="page"
              as="h2"
              title={page.site.name}
              className="items-center"
            />
            <StatusBadge status={status}>
              {status === "attention" ? "Warning" : SITE_STATUS_LABEL[status]}
            </StatusBadge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-muted-foreground">
            <span className="font-mono">{host(page.site.origin)}</span>
            {/* The separator travels with the item that follows it, so a wrap never
                leaves a dangling dot at the end of a line. */}
            <span className="flex items-center gap-2">
              <Dot />
              {page.latest ? `Last scanned ${ago(page.latest.finishedAt)}` : "Not scanned yet"}
            </span>
            {helper && helper.kind === "installed" ? (
              <span className="flex items-center gap-2">
                <Dot />
                <span className="text-success">
                  helper {helper.version} · {helperCapabilityLine(canUpdate, canLogin)}
                </span>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <Button variant="outline" size="sm" disabled={loginBusy} aria-busy={loginBusy} onClick={openWpAdmin}>
              {loginBusy ? <Spinner size={14} /> : <LogInIcon />}
              WP Admin
            </Button>
          ) : null}
          <Button size="sm" disabled={scanning} aria-busy={scanning} onClick={() => void startScan()}>
            {scanning ? <Spinner size={14} /> : <RefreshCwIcon />}
            {scanning ? "Scanning…" : "Scan now"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">
            Findings
            {issueItems.length ? <TabCount status={status}>{issueItems.length}</TabCount> : null}
          </TabsTrigger>
          <TabsTrigger value="updates">
            Updates
            {updateItems.length ? <TabCount status="attention">{updateItems.length}</TabCount> : null}
          </TabsTrigger>
          <TabsTrigger value="plugins">
            Plugins
            {plugins.length ? <TabCount status="unknown">{plugins.length}</TabCount> : null}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <div className="grid gap-5 px-(--gutter) py-5 lg:grid-cols-[minmax(0,1fr)_clamp(17.5rem,32%,21rem)]">
          <div className="min-w-0">
            <ScanOperationBanner
              operation={operation}
              scanning={scanning}
              historyReady={Boolean(page.username)}
              onRetry={() => void startScan()}
              retryBusy={scanBusy}
            />
            {helperError ? (
              <p className="mt-2 text-sm text-destructive" role="alert" aria-live="assertive">
                {helperError}
              </p>
            ) : null}

            <TabsContent value="findings" className="mt-3 space-y-3">
              {!page.latest ? (
                scanning ? null : (
                  <p className="text-sm text-muted-foreground">{COPY.row.notScannedYet}</p>
                )
              ) : issueItems.length ? (
                <div className="space-y-2.5">
                  {issueItems.map((item) => (
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
                </div>
              ) : (
                <EmptyNote tone="positive">{COPY.row.noAction}</EmptyNote>
              )}

              {groups.informational.length ? (
                <InformationalFindings
                  items={groups.informational}
                  open={infoOpen}
                  onOpenChange={setInfoOpen}
                />
              ) : null}

              <HelperHelp helper={helper} />
            </TabsContent>

            <TabsContent value="updates" className="mt-3 space-y-3">
              {updateItems.length ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading title="Pending updates" />
                    {canUpdate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmJob({
                            title: `Update ${updateItems.length} item${updateItems.length === 1 ? "" : "s"}?`,
                            description:
                              "Update every plugin and theme that has a wordpress.org update? Core is not included.",
                            action: "Update all",
                            run: () => applyHelper("/update", { kind: "all" }, "Could not update"),
                          })
                        }
                      >
                        Update all {updateItems.length}
                      </Button>
                    ) : null}
                  </div>
                  <Card className="py-0.5">
                    {updateItems.map((item) => (
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
                  </Card>
                  <HelperHelp helper={helper} />
                </>
              ) : (
                <EmptyNote tone="positive">Everything is on its latest version.</EmptyNote>
              )}
            </TabsContent>

            <TabsContent value="plugins" className="mt-3">
              {plugins.length ? (
                <Card className="py-0.5">
                  {plugins.map((plugin) => (
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
                  ))}
                </Card>
              ) : (
                <EmptyNote>No plugin list yet. Scan with a working Application Password.</EmptyNote>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-3">
              <Card className="px-4 py-3.5">
                <ScanTimeline page={page} />
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-3 space-y-3">
              <Card className="gap-2 p-3.5">
                <SectionHeading
                  title="Credentials"
                  description={
                    <>
                      wwatch signs in as <span className="font-mono">{page.username}</span> with an Application
                      Password. Replace it if scans start failing with an authorization error.
                    </>
                  }
                />
                <div>
                  <Button variant="outline" size="sm" type="button" onClick={onEdit}>
                    Edit credentials
                  </Button>
                </div>
              </Card>
              <Card className="gap-2 p-3.5">
                <SectionHeading
                  title="Remove site"
                  description="The site is removed from this board. WordPress itself is not changed."
                />
                <div>
                  <Button variant="outline" size="sm" type="button" onClick={() => setRemoveOpen(true)}>
                    Remove site
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </div>

          <aside className="space-y-3">
            <AtAGlance page={page} />
            <Card>
              <CardHeader>
                <CardTitle>Recent scans</CardTitle>
              </CardHeader>
              <CardContent>
                <ScanTimeline page={page} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </Tabs>

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
                  onBack();
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
                      body: JSON.stringify({ plugin: pluginChange.plugin, status: pluginChange.status }),
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

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/50">
      ·
    </span>
  );
}

/** A tiny pill on the tab. Tinted only when the count is something to act on. */
function TabCount({ status, children }: { status: SiteStatus; children: React.ReactNode }) {
  const toned = status === "critical" || status === "attention";
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[11px] leading-none tabular-nums",
        toned
          ? cn(TONE_ACCENT[toneOf(status)], TONE_SURFACE[toneOf(status)], "border-0")
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Findings with nothing to decide. One clickable row on a muted surface that opens into
 * the list, so the low-priority half of a scan never competes with the actionable half.
 */
function InformationalFindings({
  items,
  open,
  onOpenChange,
}: {
  items: DisplayFinding[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-raised">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] text-muted-foreground",
          "transition-colors hover:bg-muted/40 hover:text-foreground",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      >
        {COPY.row.informational(items.length)}
        <ChevronRightIcon
          className={cn("size-4 shrink-0 transition-transform duration-150", open && "rotate-90")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-hairline">
          {items.map((item) => (
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
        </div>
      ) : null}
    </div>
  );
}

function helperCapabilityLine(canUpdate: boolean, canLogin: boolean): string {
  const parts = [canUpdate ? "updates" : null, canLogin ? "login" : null].filter(Boolean);
  if (!parts.length) {
    return "no extra capabilities";
  }
  return `${parts.join(" and ")} available`;
}

/**
 * Only what a `ScanSnapshot` actually carries. The mockup also showed a PHP version and a
 * core-checksum result; those are computed server-side into findings and are not on the
 * client-side helper payload, so they are not invented here.
 */
function AtAGlance({ page }: { page: SitePageData }) {
  const findings = page.latest?.findings ?? [];
  const helper = page.latest?.helper ?? null;
  const tls = tlsDaysLeftOf(findings);
  const active = (page.latest?.plugins ?? []).filter((plugin) => plugin.status === "active").length;

  const helperInstalled = helper !== null && helper.kind === "installed";
  const rows: GlanceRow[] = [
    { label: "WordPress", value: page.latest?.coreVersion ?? null },
    ...(tls === null ? [] : [{ label: "TLS", value: `${tls}d left`, tone: TONE_ACCENT.warning }]),
    helperInstalled
      ? { label: "Helper", value: helper.version, tone: TONE_ACCENT.healthy }
      : { label: "Helper", value: "Not installed", badge: true },
    { label: "Plugins", value: `${active} active` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="m-0 flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] leading-5 text-muted-foreground">{row.label}</dt>
              <dd className="m-0 min-w-0 text-right">
                {row.value === null ? (
                  <span className="font-mono text-[12.5px] leading-5 text-muted-foreground">&mdash;</span>
                ) : row.badge ? (
                  <Badge variant="secondary" className="h-5 px-2 text-[11px] font-medium">
                    {row.value}
                  </Badge>
                ) : (
                  <span
                    className={cn(
                      "font-mono text-[12.5px] leading-5 tabular-nums",
                      row.tone ?? "text-foreground",
                    )}
                  >
                    {row.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

type GlanceRow = {
  label: string;
  /** `null` is data the last scan did not carry; it renders as one muted em dash. */
  value: string | null;
  tone?: string;
  /** Status-like values read better as a pill than as a monospaced string. */
  badge?: boolean;
};
