import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, ExternalLinkIcon, LogInIcon, RefreshCwIcon } from "lucide-react";
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
import { siteActionabilityGroups } from "@/lib/finding-groups";
import { tlsDaysLeftOf } from "@/lib/fleet-table";
import { ago, host } from "@/lib/format";
import { helperCan } from "@/lib/helper";
import { scanOperationOf } from "@/lib/scan-operation";
import { effectiveStatus } from "@/lib/site-status";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/status";
import { TONE_ACCENT, toneOf } from "@/lib/tone";
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
      <div className="px-(--gutter) pt-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2.5" onClick={onBack}>
          <ArrowLeftIcon />
          Fleet
        </Button>
      </div>

      <header className="flex flex-wrap items-start gap-x-4 gap-y-3 px-(--gutter) pt-3 pb-4">
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
          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-mono">{host(page.site.origin)}</span>
            <span aria-hidden className="text-border">
              |
            </span>
            <span>{page.latest ? `Last scanned ${ago(page.latest.finishedAt)}` : "Not scanned yet"}</span>
            {helper && helper.kind === "installed" ? (
              <>
                <span aria-hidden className="text-border">
                  |
                </span>
                <span className="text-success">
                  helper {helper.version} · {helperCapabilityLine(canUpdate, canLogin)}
                </span>
              </>
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

        <div className="grid gap-6 px-(--gutter) py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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

            <TabsContent value="findings" className="mt-3">
              {!page.latest ? (
                scanning ? null : (
                  <p className="text-sm text-muted-foreground">{COPY.row.notScannedYet}</p>
                )
              ) : issueItems.length ? (
                issueItems.map((item) => (
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
                ))
              ) : (
                <EmptyNote tone="positive">{COPY.row.noAction}</EmptyNote>
              )}

              {groups.informational.length ? (
                <div className="mt-4 rounded-md border border-hairline bg-raised px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-muted-foreground">
                      {COPY.row.informational(groups.informational.length)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-expanded={infoOpen}
                      onClick={() => setInfoOpen(!infoOpen)}
                    >
                      {infoOpen ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {infoOpen
                    ? groups.informational.map((item) => (
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
                      ))
                    : null}
                </div>
              ) : null}

              <HelperHelp helper={helper} />
            </TabsContent>

            <TabsContent value="updates" className="mt-3">
              {updateItems.length ? (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
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
                  <HelperHelp helper={helper} />
                </>
              ) : (
                <EmptyNote tone="positive">Everything is on its latest version.</EmptyNote>
              )}
            </TabsContent>

            <TabsContent value="plugins" className="mt-3">
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
            </TabsContent>

            <TabsContent value="activity" className="mt-3">
              <ScanTimeline page={page} />
            </TabsContent>

            <TabsContent value="settings" className="mt-3 space-y-4">
              <div>
                <SectionHeading title="Credentials" />
                <p className="mt-1 mb-2 max-w-[62ch] text-[13px] text-muted-foreground">
                  wwatch signs in as <span className="font-mono">{page.username}</span> with an Application
                  Password. Replace it if scans start failing with an authorization error.
                </p>
                <Button variant="outline" size="sm" type="button" onClick={onEdit}>
                  Edit credentials
                </Button>
              </div>
              <div>
                <SectionHeading title="Remove site" />
                <p className="mt-1 mb-2 max-w-[62ch] text-[13px] text-muted-foreground">
                  The site is removed from this board. WordPress itself is not changed.
                </p>
                <Button variant="outline" size="sm" type="button" onClick={() => setRemoveOpen(true)}>
                  Remove site
                </Button>
              </div>
            </TabsContent>
          </div>

          <aside className="space-y-4">
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

function TabCount({ status, children }: { status: SiteStatus; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "font-mono text-[12px] tabular-nums",
        status === "critical" || status === "attention" ? TONE_ACCENT[toneOf(status)] : "text-muted-foreground",
      )}
    >
      {children}
    </span>
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

  const rows: { label: string; value: string; tone?: string }[] = [
    { label: "WordPress", value: page.latest?.coreVersion ?? "Unknown" },
    ...(tls === null ? [] : [{ label: "TLS", value: `${tls}d left`, tone: TONE_ACCENT.warning }]),
    {
      label: "Helper",
      value: helper && helper.kind === "installed" ? helper.version : "Not installed",
      ...(helper && helper.kind === "installed" ? { tone: TONE_ACCENT.healthy } : {}),
    },
    { label: "Plugins", value: `${active} active` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="m-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0"
          >
            <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
            <dd className={cn("m-0 font-mono text-[12.5px] tabular-nums", row.tone ?? "text-foreground")}>
              {row.value}
            </dd>
          </div>
        ))}
        </dl>
      </CardContent>
    </Card>
  );
}
