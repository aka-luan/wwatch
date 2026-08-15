import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppProviders } from "@/components/app-providers";
import { FindingRow } from "@/components/finding-row";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { ago, host } from "@/lib/format";
import { rollupLabel, siteStatusFromRollup, siteStatusFromSeverity } from "@/lib/status";
import type { Finding, InstalledPlugin, OverviewRow, ScanSummary, SitePage } from "@/lib/types";

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
  const problems = sites.filter(
    (row) => row.rollup === "degraded" || row.rollup === "down" || row.rollup === "auth_failed",
  ).length;
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

function SiteList({
  sites,
  loaded,
  onOpen,
}: {
  sites: OverviewRow[];
  loaded: boolean;
  onOpen: (id: string) => void;
}) {
  if (!loaded) {
    return (
      <div className="board-wrap">
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mt-2 h-12 w-full" />
      </div>
    );
  }
  if (sites.length === 0) {
    return (
      <div className="empty">
        <h2>No sites yet</h2>
        <p>
          Add a WordPress site you already admin. wwatch talks to it with an Application Password from
          Users → Profile. Nothing gets installed on the site.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="board-wrap">
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Status</th>
              <th>Core</th>
              <th>Plugins</th>
              <th>Findings</th>
              <th>Last scan</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((row) => {
              const summary = rowSummary(row);
              return (
                <tr
                  key={row.site.id}
                  className="row"
                  onClick={() => onOpen(row.site.id)}
                >
                  <td>
                    <div>{row.site.name}</div>
                    <div className="mono host">{host(row.site.origin)}</div>
                  </td>
                  <td>
                    <StatusPills row={row} />
                  </td>
                  <td className="mono">{row.latest?.coreVersion ?? "—"}</td>
                  <td>
                    {summary.plugins.length
                      ? `${summary.plugins.length} installed${summary.updates ? `, ${summary.updates} updates` : ""}`
                      : "—"}
                  </td>
                  <td>{summary.findings.length ? `${summary.crit} crit · ${summary.warn} warn` : "—"}</td>
                  <td>{scanLabel(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="board-cards">
        {sites.map((row) => {
          const summary = rowSummary(row);
          const pluginLabel = summary.plugins.length
            ? `${summary.plugins.length} plugin${summary.plugins.length === 1 ? "" : "s"}${
                summary.updates ? `, ${summary.updates} update${summary.updates === 1 ? "" : "s"}` : ""
              }`
            : "No plugins";
          const findingLabel = summary.findings.length
            ? `${summary.crit} crit · ${summary.warn} warn`
            : "No findings";
          const coreLabel = row.latest?.coreVersion ? `WP ${row.latest.coreVersion}` : "No core version";
          return (
            <button
              key={row.site.id}
              type="button"
              className="site-card"
              onClick={() => onOpen(row.site.id)}
            >
              <div className="site-card-head">
                <div>
                  <div className="site-card-name">{row.site.name}</div>
                  <div className="mono host">{host(row.site.origin)}</div>
                </div>
                <div className="site-card-pills">
                  <StatusPills row={row} />
                </div>
              </div>
              <div className="site-card-meta">
                <span className="mono">{coreLabel}</span>
                <span>{pluginLabel}</span>
                <span>{findingLabel}</span>
                <span>{scanLabel(row)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StatusPills({ row }: { row: OverviewRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge status={siteStatusFromRollup(row.rollup)}>{rollupLabel(row.rollup)}</StatusBadge>
      {row.running && row.latest ? (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Badge
              variant="info"
              className="h-auto px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase"
            >
              scan
            </Badge>
          </TooltipTrigger>
          <TooltipContent>A scan is running. The last finished snapshot is still shown.</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
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
  const previous = (page.history ?? []).filter((scan) => scan.id !== page.latest?.id);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pluginChange, setPluginChange] = useState<{
    plugin: string;
    name: string;
    status: "active" | "inactive";
  } | null>(null);

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
      <h3>Findings</h3>
      {findings.length ? (
        findings.map((finding) => (
          <FindingRow
            key={`${finding.kind}:${finding.title}:${finding.detail}`}
            status={siteStatusFromSeverity(finding.severity)}
            statusLabel={finding.severity}
            title={finding.title}
            detail={finding.detail}
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
            onToggle={(next) => setPluginChange(next)}
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
    </aside>
  );
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
  onToggle,
}: {
  plugin: InstalledPlugin;
  findings: Finding[];
  onToggle: (next: { plugin: string; name: string; status: "active" | "inactive" }) => void;
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
      <Button
        variant="outline"
        type="button"
        onClick={() => onToggle({ plugin: plugin.ref, name: plugin.name, status: next })}
      >
        Set {next}
      </Button>
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

function rowSummary(row: OverviewRow) {
  const findings = row.latest?.findings ?? [];
  const plugins = row.latest?.plugins ?? [];
  return {
    findings,
    plugins,
    updates: findings.filter((finding) => finding.kind === "plugin_update").length,
    crit: findings.filter((finding) => finding.severity === "crit").length,
    warn: findings.filter((finding) => finding.severity === "warn").length,
  };
}

function scanLabel(row: OverviewRow) {
  if (row.running) {
    return row.latest ? `scanning · ${ago(row.latest.finishedAt)}` : "scanning…";
  }
  return ago(row.latest?.finishedAt);
}
