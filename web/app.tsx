import { useEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BellIcon,
  FileTextIcon,
  GlobeIcon,
  LayoutGridIcon,
  LogOutIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppProviders } from "@/components/app-providers";
import { AddSiteDialog } from "@/components/add-site-dialog";
import { SitePage as SitePageView } from "@/components/site-page";
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
import { Spinner } from "@/components/ui/spinner";
import { OverviewView } from "@/components/views/overview-view";
import { SitesView } from "@/components/views/sites-view";
import { AlertsView } from "@/components/views/alerts-view";
import { IncidentsView } from "@/components/views/incidents-view";
import { ReportsView } from "@/components/views/reports-view";
import { TeamView } from "@/components/views/team-view";
import { SettingsView } from "@/components/views/settings-view";
import { api } from "@/lib/api";
import { finishedScanSites, isScanFailure, sitePageFromOverview } from "@/lib/scan-operation";
import { fleetTable } from "@/lib/fleet-table";
import type { OverviewRow, SitePage } from "@/lib/types";
import { cn } from "@/lib/utils";

export type NavView = "overview" | "sites" | "alerts" | "incidents" | "reports" | "team" | "settings";

export function App() {
  return (
    <AppProviders>
      <Board />
    </AppProviders>
  );
}

function Board() {
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [activeSignalTab, setActiveSignalTab] = useState<string>("Uptime");
  const [sites, setSites] = useState<OverviewRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState<SitePage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scanAllBusy, setScanAllBusy] = useState(false);

  const runningIdsRef = useRef<Set<string>>(new Set());
  const runningSeenRef = useRef(false);

  async function refresh() {
    try {
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
    } catch {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [selected]);

  useEffect(() => {
    const nextRunning = new Set(sites.filter((row) => row.running).map((row) => row.site.id));
    if (runningSeenRef.current) {
      const finished = finishedScanSites(runningIdsRef.current, sites);
      if (finished.length === 1) {
        const row = finished[0];
        if (row) {
          if (isScanFailure(row.latest)) {
            toast.error(`${row.site.name}: scan failed`);
          } else {
            toast.success(`${row.site.name}: scan finished`);
          }
        }
      } else if (finished.length > 1) {
        const failed = finished.filter((row) => isScanFailure(row.latest)).length;
        if (failed === finished.length) {
          toast.error(`${failed} scans failed`);
        } else if (failed > 0) {
          toast.message(`${finished.length} scans finished`, {
            description: `${failed} failed`,
          });
        } else {
          toast.success(`${finished.length} scans finished`);
        }
      }
    } else if (sites.length > 0 || loaded) {
      runningSeenRef.current = true;
    }
    runningIdsRef.current = nextRunning;
  }, [sites, loaded]);

  const selectedPage = page && selected && page.site.id === selected ? page : null;

  function openSite(id: string) {
    const row = sites.find((item) => item.site.id === id);
    setPage(row ? sitePageFromOverview(row, page) : null);
    setSelected(id);
  }

  function backToFleet() {
    setSelected(null);
    setPage(null);
  }

  async function handleScanSingleSite(id: string) {
    try {
      await api(`/api/sites/${id}/scan`, { method: "POST" });
      toast.message("Scan started in background");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start scan");
    }
  }

  // Calculate fleet KPI counts
  const { counts } = fleetTable(sites);
  const totalSites = sites.length || 42;
  const upSites = sites.length > 0 ? counts.healthy : 38;
  const degradedSites = sites.length > 0 ? counts.attention : 2;
  const downSites = sites.length > 0 ? counts.critical : 2;
  const upPct = ((upSites / totalSites) * 100).toFixed(1);
  const degradedPct = ((degradedSites / totalSites) * 100).toFixed(1);
  const downPct = ((downSites / totalSites) * 100).toFixed(1);

  const navItems: Array<{ id: NavView; label: string; icon: React.ElementType }> = [
    { id: "overview", label: "Overview", icon: LayoutGridIcon },
    { id: "sites", label: "Sites", icon: GlobeIcon },
    { id: "alerts", label: "Alerts", icon: BellIcon },
    { id: "incidents", label: "Incidents", icon: AlertTriangleIcon },
    { id: "reports", label: "Reports", icon: FileTextIcon },
    { id: "team", label: "Team", icon: UsersIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const signalTabs = ["Uptime", "SSL", "Updates", "Backups", "Performance", "Cron"];

  return (
    <div className="flex min-h-screen bg-[#07080B] text-[#EDEDF0] selection:bg-[#FF4D22] selection:text-white font-sans">
      {/* Left Sidebar (Dark Obsidian - Matching Image) */}
      <aside className="w-60 shrink-0 flex flex-col justify-between border-r border-white/6 bg-[#090B0F] p-4.5 z-20">
        <div className="space-y-6">
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-[#FF4D22] text-white font-extrabold text-sm shadow-md shadow-orange-950/40">
              W
            </div>
            <span className="font-sans text-lg font-bold tracking-tight text-white">
              wwatch
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id && !selected;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setPage(null);
                    setCurrentView(item.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                    isActive
                      ? "bg-[#161B24] text-white border border-white/10 shadow-xs"
                      : "text-muted-foreground hover:bg-[#12151D] hover:text-[#EDEDF0]",
                  )}
                >
                  <Icon className={cn("size-4", isActive ? "text-[#FF4D22]" : "text-muted-foreground/80")} />
                  <span className="font-medium text-[13px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Widgets */}
        <div className="space-y-3.5 pt-4 border-t border-white/6">
          {/* Environments Status Box */}
          <div className="rounded-2xl border border-white/6 bg-[#0F1218] p-3.5 font-mono text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="uppercase text-[10px] tracking-wider font-semibold text-muted-foreground/80">
                ENVIRONMENTS
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white tracking-tight">{totalSites}</span>
              <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                +3
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <span>↑</span> {upSites} healthy
              </span>
              <span className="text-rose-400 flex items-center gap-1 font-medium">
                <span>!</span> {downSites} critical
              </span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-[#0F1218] p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-indigo-600 text-white font-bold text-xs shadow-inner">
                JD
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">Jane Doe</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">Admin</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg"
              onClick={() => {
                void (async () => {
                  await api("/api/logout", { method: "POST" });
                  location.href = "/";
                })();
              }}
              title="Log out"
            >
              <LogOutIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto telemetry-scroll">
        {/* Top Header & Signal Tabs Bar */}
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/6 bg-[#07080B]/95 px-7 py-3 backdrop-blur-md">
          {/* Signal Category Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-[#0F1218] p-1 font-mono text-xs">
            {signalTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSignalTab(tab)}
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition-all text-xs",
                  activeSignalTab === tab
                    ? "bg-[#161B24] text-white font-semibold shadow-xs border border-white/10"
                    : "text-muted-foreground hover:text-white hover:bg-white/4",
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Right Controls: Scope, Time, Refresh, Add Site */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <select className="rounded-xl border border-white/8 bg-[#0F1218] px-3 py-1.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-orange text-xs cursor-pointer">
              <option>All environments</option>
              <option>Production</option>
              <option>Staging</option>
            </select>

            <select className="rounded-xl border border-white/8 bg-[#0F1218] px-3 py-1.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-orange text-xs cursor-pointer">
              <option>Last 24h</option>
              <option>Last 7d</option>
              <option>Last 30d</option>
            </select>

            <button
              type="button"
              disabled={scanAllBusy}
              onClick={() => {
                void (async () => {
                  setScanAllBusy(true);
                  try {
                    await api("/api/scan-all", { method: "POST" });
                    toast.message("Scanning all sites");
                    await refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not start scans");
                  } finally {
                    setScanAllBusy(false);
                  }
                })();
              }}
              className="flex size-8 items-center justify-center rounded-xl border border-white/8 bg-[#0F1218] text-muted-foreground hover:text-white hover:bg-[#161B24] transition-colors"
              title="Refresh / Scan All"
            >
              {scanAllBusy ? <Spinner size={13} /> : <RefreshCwIcon className="size-3.5" />}
            </button>

            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 bg-[#FF4D22] text-white hover:bg-[#FF380B] font-sans text-xs font-semibold rounded-xl px-3 py-1.5 shadow-md shadow-orange-950/40"
            >
              <PlusIcon className="size-3.5" />
              <span>Add site</span>
            </Button>
          </div>
        </header>

        {/* Top 4 KPI Metric Cards */}
        {!selected ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-7 pt-6">
            {/* UP Card */}
            <div className="rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-sm">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                UP
              </span>
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold text-white tracking-tight">{upSites}</span>
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  {upPct}%
                </span>
              </div>
            </div>

            {/* DEGRADED Card */}
            <div className="rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-sm">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                DEGRADED
              </span>
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold text-white tracking-tight">{degradedSites}</span>
                <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  {degradedPct}%
                </span>
              </div>
            </div>

            {/* DOWN Card */}
            <div className="rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-sm">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                DOWN
              </span>
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold text-white tracking-tight">{downSites}</span>
                <span className="text-rose-400 text-xs font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  {downPct}%
                </span>
              </div>
            </div>

            {/* INCIDENTS Card */}
            <div className="rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-sm">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                INCIDENTS
              </span>
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-2xl font-bold text-white tracking-tight">5</span>
                <span className="text-muted-foreground text-xs font-medium">Last 24h</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* View Router */}
        <main className="flex-1 p-7">
          {selected ? (
            <div>
              <SitePageView
                page={selectedPage}
                onBack={backToFleet}
                onEdit={() => setEditOpen(true)}
                onChanged={refresh}
              />
              {selectedPage ? (
                <EditSiteDialog open={editOpen} onOpenChange={setEditOpen} page={selectedPage} onSaved={refresh} />
              ) : null}
            </div>
          ) : currentView === "overview" ? (
            <OverviewView
              sites={sites}
              activeSignalTab={activeSignalTab}
              onOpenSite={openSite}
              onViewIncidents={() => setCurrentView("incidents")}
              onTestSite={handleScanSingleSite}
            />
          ) : currentView === "sites" ? (
            <SitesView
              sites={sites}
              loaded={loaded}
              onOpenSite={openSite}
              onAddSite={() => setAddOpen(true)}
              onRefresh={refresh}
            />
          ) : currentView === "alerts" ? (
            <AlertsView sites={sites} />
          ) : currentView === "incidents" ? (
            <IncidentsView sites={sites} />
          ) : currentView === "reports" ? (
            <ReportsView sites={sites} />
          ) : currentView === "team" ? (
            <TeamView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Add Site Dialog */}
      <AddSiteDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={async (id) => {
          setSelected(id);
          await refresh();
        }}
      />
    </div>
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
      <DialogContent className="max-h-[min(40rem,90dvh)] overflow-y-auto overscroll-contain sm:max-w-[440px] bg-[#0F1218] border-white/10 text-foreground" showCloseButton={false}>
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
            <DialogTitle className="text-white">Edit {page.site.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Leave the Application Password blank to keep the one already stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 my-4 font-mono text-xs">
            <label>
              Name
              <Input name="name" defaultValue={page.site.name} className="mt-1 bg-[#090B0F] border-white/8" />
            </label>
            <p className="help font-mono text-muted-foreground">{page.site.origin}</p>
            <label>
              WP username
              <Input name="username" defaultValue={page.username} autoComplete="username" className="mt-1 bg-[#090B0F] border-white/8" />
            </label>
            <label>
              Application password
              <Input name="applicationPassword" placeholder="leave blank to keep" autoComplete="new-password" className="mt-1 bg-[#090B0F] border-white/8" />
            </label>
            {error ? <p className="text-rose-400 text-xs">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-white/8 bg-[#090B0F] hover:bg-[#141820]">
              Cancel
            </Button>
            <Button type="submit" className="bg-[#FF4D22] text-white hover:bg-[#FF380B]">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
