import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppProviders } from "@/components/app-providers";
import { FindingRow } from "@/components/finding-row";
import { SiteList } from "@/components/site-list";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { helperCan, isRepairablePath } from "@/lib/helper";
import { rollupLabel, siteStatusFromRollup, siteStatusFromSeverity, siteStatusOf } from "@/lib/status";
import type { Finding, HelperInfo, InstalledPlugin, OverviewRow, ScanSummary, SitePage } from "@/lib/types";

export function App() {
  return (
    <AppProviders>
      <Board />
    </AppProviders>
  );
}

function Board() {
  const [sites, setSites] = useState<OverviewRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState<SitePage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function refresh() {
    const rows = await api<OverviewRow[]>("/api/sites");
    setSites(rows);
    setLoaded(true);
    if (!selected) {
      setPage(null);
      return;
    }
    const row = rows.find((item) => item.site.id === selected);
    if (!row) {
      setSelected(null);
      setPage(null);
      return;
    }
    setPage(await api<SitePage>(`/api/sites/${selected}`));
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [selected]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", Boolean(selected));
  }, [selected]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (addOpen || editOpen) {
        return;
      }
      setSelected(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addOpen, editOpen]);

  const selectedRow = page;

  return (
    <>
      <header className="top">
        <div>
          <p className="mark">wwatch</p>
          <p className="sub">WordPress fleet</p>
        </div>
        <div className="actions">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              void (async () => {
                await api("/api/scan-all", { method: "POST" });
                toast.success("Scan started");
                await refresh();
              })();
            }}
          >
            Scan all
          </Button>
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add site
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              void (async () => {
                await api("/api/logout", { method: "POST" });
                location.href = "/";
              })();
            }}
          >
            Log out
          </Button>
        </div>
      </header>
      <Stats sites={sites} loaded={loaded} />
      <main>
        <SiteList
          sites={sites}
          loaded={loaded}
          onOpen={(id) => {
            setSelected(id);
          }}
        />
      </main>
      {selectedRow ? (
        <SiteDrawer
          page={selectedRow}
          onClose={() => setSelected(null)}
          onEdit={() => setEditOpen(true)}
          onChanged={refresh}
        />
      ) : null}
      <AddSiteDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={async (id) => {
          setSelected(id);
          await refresh();
        }}
      />
      {selectedRow ? (
        <EditSiteDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          page={selectedRow}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}

function Stats({ sites, loaded }: { sites: OverviewRow[]; loaded: boolean }) {
  const problems = sites.filter((row) => {
    const status = siteStatusOf(row);
    return status === "critical" || status === "attention";
  }).length;
  const scanning = sites.filter((row) => row.running).length;
  if (!loaded) {
    return (
      <section className="stats">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </section>
    );
  }
  return (
    <section className="stats">
      <span>
        <b>{sites.length}</b> sites
      </span>
      <span>
        <b>{problems}</b> need attention
      </span>
      <span>
        <b>{scanning}</b> scanning
      </span>
    </section>
  );
}

function SiteDrawer({
  page,
  onClose,
  onEdit,
  onChanged,
}: {
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
    <aside className="drawer">
      <header>
        <div>
          <h2>{page.site.name}</h2>
          <p className="origin">
            <a href={page.site.origin} target="_blank" rel="noreferrer">
              {page.site.origin}
            </a>
          </p>
        </div>
        <div className="actions">
          <Button
            variant="outline"
            type="button"
            disabled={loginBusy}
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
            Log in
          </Button>
          {canUpdate && updateFindings.length ? (
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                setConfirmJob({
                  title: "Update plugins and themes?",
                  description: "Update every plugin and theme that has a wordpress.org update? Core is not included.",
                  action: "Update all",
                  run: () => applyHelper("/update", { kind: "all" }, "Could not update"),
                })
              }
            >
              Update all
            </Button>
          ) : null}
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              void (async () => {
                await api(`/api/sites/${page.site.id}/scan`, { method: "POST" });
                toast.success("Scan started");
                await onChanged();
              })();
            }}
          >
            Scan
          </Button>
          <Button variant="outline" type="button" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="outline" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </header>
      <p>
        <StatusBadge status={siteStatusFromRollup(page.rollup)}>{rollupLabel(page.rollup)}</StatusBadge>
        {page.latest?.coreVersion ? ` · WP ${page.latest.coreVersion}` : ""}
      </p>
      <HelperHelp helper={helper} />
      {helperError ? <p className="error">{helperError}</p> : null}
      <h3>Findings</h3>
      {findings.length ? (
        findings.map((finding) => (
          <FindingRow
            key={`${finding.kind}:${finding.title}:${finding.detail}`}
            status={siteStatusFromSeverity(finding.severity)}
            statusLabel={finding.severity}
            title={finding.title}
            detail={finding.detail}
            action={findingAction(finding, helper, page.site.name, setConfirmJob, applyHelper)}
          />
        ))
      ) : (
        <p className="help">No findings on the last scan.</p>
      )}
      <h3>Previous scans</h3>
      {previous.length ? (
        previous.map((scan) => <ScanHistoryRow key={scan.id} scan={scan} />)
      ) : (
        <p className="help">No earlier scans.</p>
      )}
      <h3>Plugins</h3>
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
        <p className="help">No plugin list yet. Scan with a working Application Password.</p>
      )}
      <div className="row-actions">
        <Button variant="destructive" type="button" onClick={() => setRemoveOpen(true)}>
          Remove site
        </Button>
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
      <AlertDialog open={Boolean(pluginChange)} onOpenChange={(open) => !open && setPluginChange(null)}>
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
      <AlertDialog open={Boolean(confirmJob)} onOpenChange={(open) => !open && setConfirmJob(null)}>
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
    </aside>
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
        <Button
          variant="outline"
          type="button"
          onClick={() =>
            confirm({
              title: `Update ${finding.title}?`,
              description: `Update ${finding.title} on ${siteName}?`,
              action: "Update",
              run: () =>
                applyHelper("/update", { kind: "plugin", plugin: finding.plugin }, "Could not update"),
            })
          }
        >
          Update
        </Button>
      );
    }
    if (finding.kind === "theme_update" && finding.theme) {
      return (
        <Button
          variant="outline"
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
        </Button>
      );
    }
    if (finding.kind === "core_update") {
      return (
        <Button
          variant="outline"
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
        </Button>
      );
    }
  }
  if (helperCan(helper, "repair")) {
    if (finding.kind === "xmlrpc_open") {
      return (
        <Button
          variant="outline"
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
        </Button>
      );
    }
    if (finding.kind === "exposed_path" && isRepairablePath(finding.path)) {
      return (
        <Button
          variant="outline"
          type="button"
          onClick={() =>
            confirm({
              title: `Delete ${finding.path}?`,
              description: `Delete ${finding.path} on ${siteName}?`,
              action: "Fix",
              run: () =>
                applyHelper("/repair", { kind: "exposed_path", path: finding.path }, "Could not repair"),
            })
          }
        >
          Fix
        </Button>
      );
    }
  }
  return undefined;
}

function ScanHistoryRow({ scan }: { scan: ScanSummary }) {
  const status = siteStatusFromRollup(scan.rollup);
  return (
    <div className="scan">
      <StatusDot status={status} decorative />
      <span>{rollupLabel(scan.rollup)}</span>
      <span>{ago(scan.finishedAt)}</span>
      <span>
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
    <div className="plugin">
      <div>
        <strong>{plugin.name}</strong>{" "}
        <Badge variant="outline" className="h-auto px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase">
          {plugin.status}
        </Badge>{" "}
        {update ? (
          <>
            <StatusBadge status="attention">warn</StatusBadge> {plugin.version} → {update.latest}
          </>
        ) : (
          <span className="mono"> {plugin.version}</span>
        )}
        <p className="mono">{plugin.ref}</p>
      </div>
      <div className="plugin-actions">
        {canUpdate && update ? (
          <Button variant="outline" type="button" onClick={() => onUpdate({ plugin: plugin.ref, name: plugin.name })}>
            Update
          </Button>
        ) : null}
        <Button
          variant="outline"
          type="button"
          onClick={() => onToggle({ plugin: plugin.ref, name: plugin.name, status: next })}
        >
          Set {next}
        </Button>
      </div>
    </div>
  );
}

function AddSiteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]" showCloseButton={false}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setError("");
            void (async () => {
              try {
                const site = await api<{ id: string }>("/api/sites", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(data),
                });
                onOpenChange(false);
                await api(`/api/sites/${site.id}/scan`, { method: "POST" });
                toast.success("Scan started");
                await onCreated(site.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not connect");
              }
            })();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a WordPress site</DialogTitle>
            <DialogDescription>
              In wp-admin open Users → Profile → Application Passwords. Create one on an administrator
              account. Username is that account's login (what you type at wp-login), not the password's
              name.
            </DialogDescription>
          </DialogHeader>
          <label>
            Name
            <Input name="name" placeholder="Bakery" />
          </label>
          <label>
            Site URL
            <Input name="origin" required placeholder="https://bakery.example" />
          </label>
          <label>
            WP username
            <Input name="username" required placeholder="your WordPress login" autoComplete="username" />
          </label>
          <label>
            Application password
            <Input name="applicationPassword" required autoComplete="current-password" />
          </label>
          <p className="error">{error}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSiteDialog({
  open,
  onOpenChange,
  page,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: SitePage;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]" showCloseButton={false}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setError("");
            const body: Record<string, string> = {
              name: String(data.name ?? ""),
              username: String(data.username ?? ""),
            };
            if (String(data.applicationPassword ?? "").trim()) {
              body.applicationPassword = String(data.applicationPassword);
            }
            void (async () => {
              try {
                await api(`/api/sites/${page.site.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(body),
                });
                onOpenChange(false);
                toast.success("Settings saved");
                await onSaved();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not update");
              }
            })();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {page.site.name}</DialogTitle>
            <DialogDescription>
              Leave the Application Password blank to keep the one already stored. Changing username or
              password checks the REST API before saving, so scan history stays.
            </DialogDescription>
          </DialogHeader>
          <label>
            Name
            <Input name="name" defaultValue={page.site.name} />
          </label>
          <p className="help mono">{page.site.origin}</p>
          <label>
            WP username
            <Input name="username" defaultValue={page.username} autoComplete="username" />
          </label>
          <label>
            Application password
            <Input name="applicationPassword" placeholder="leave blank to keep" autoComplete="new-password" />
          </label>
          <p className="error">{error}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
