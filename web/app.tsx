import { useEffect, useMemo, useState } from "react";
import { ScanLineIcon } from "lucide-react";
import { toast } from "sonner";
import { AppProviders } from "@/components/app-providers";
import { AddSiteDialog } from "@/components/add-site-dialog";
import { ProcessingIndicator } from "@/components/processing-indicator";
import { SiteFilters } from "@/components/site-filters";
import { SiteList } from "@/components/site-list";
import { SiteSheet } from "@/components/site-sheet";
import { UpdatesEntry, UpdatesReviewDialog } from "@/components/updates-review";
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
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { fleetUpdateSummary } from "@/lib/fleet-updates";
import { emptyFilterState, filterSites, type SiteFilterState } from "@/lib/site-filters";
import { sitePageFromOverview } from "@/lib/scan-operation";
import type { OverviewRow, SitePage } from "@/lib/types";

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
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [scanAllBusy, setScanAllBusy] = useState(false);
  const [filters, setFilters] = useState<SiteFilterState>(emptyFilterState);

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

  const selectedPage = page && selected && page.site.id === selected ? page : null;
  const filteredSites = filterSites(sites, filters);
  const scanning = sites.filter((row) => row.running).length;
  const updates = useMemo(() => fleetUpdateSummary(sites), [sites]);

  return (
    <div className="board">
      <header className="top">
        <div>
          <p className="mark">wwatch</p>
          <p className="sub">WordPress fleet</p>
        </div>
        <div className="actions">
          <div className="actions-main">
            <Button
              variant="ghost"
              type="button"
              disabled={scanAllBusy}
              aria-busy={scanAllBusy}
              onClick={() => {
                void (async () => {
                  setScanAllBusy(true);
                  try {
                    await api("/api/scan-all", { method: "POST" });
                    toast.success("Scan started");
                    await refresh();
                  } finally {
                    setScanAllBusy(false);
                  }
                })();
              }}
            >
              {scanAllBusy ? <Spinner size={14} /> : <ScanLineIcon className="size-4" aria-hidden />}
              Scan all
            </Button>
            <Button type="button" onClick={() => setAddOpen(true)}>
              Add site
            </Button>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="logout"
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
      {loaded ? (
        sites.length > 0 ? (
          <div className="board-toolbar">
            <SiteFilters sites={sites} state={filters} onChange={setFilters} />
            {updates.updateCount > 0 || scanning > 0 ? (
              <div className="board-toolbar-meta">
                <UpdatesEntry summary={updates} onReview={() => setUpdatesOpen(true)} />
                {scanning > 0 ? (
                  <p className="scanning-note">
                    <ProcessingIndicator
                      label={
                        <>
                          <b className="font-medium text-foreground">{scanning}</b> scanning
                        </>
                      }
                      size={12}
                    />
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null
      ) : (
        <div className="board-toolbar">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 min-w-0 flex-1" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="flex gap-1 py-0.5">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      )}
      <main>
        <SiteList
          sites={filteredSites}
          fleetCount={sites.length}
          filters={filters}
          onClearFilters={() => setFilters(emptyFilterState())}
          loaded={loaded}
          onOpen={(id) => {
            if (id !== selected) {
              const row = sites.find((item) => item.site.id === id);
              setPage(row ? sitePageFromOverview(row, page) : null);
            }
            setSelected(id);
          }}
        />
      </main>
      <SiteSheet
        open={selected !== null}
        page={selectedPage}
        onOpenChange={(open) => {
          if (!open) {
            if (addOpen || editOpen) {
              return;
            }
            setSelected(null);
            setPage(null);
          }
        }}
        onEdit={() => setEditOpen(true)}
        onChanged={refresh}
      />
      <UpdatesReviewDialog
        open={updatesOpen}
        onOpenChange={setUpdatesOpen}
        sites={sites}
        onChanged={refresh}
      />
      <AddSiteDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={async (id) => {
          setSelected(id);
          await refresh();
        }}
      />
      {selectedPage ? (
        <EditSiteDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          page={selectedPage}
          onSaved={refresh}
        />
      ) : null}
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
