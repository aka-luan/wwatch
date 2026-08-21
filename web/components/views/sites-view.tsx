import { useState } from "react";
import { PlusIcon, ScanLineIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FleetCards } from "@/components/fleet-cards";
import { FleetSelectionBar } from "@/components/fleet-selection-bar";
import { FleetStatStrip } from "@/components/fleet-stat-strip";
import { FleetTable } from "@/components/fleet-table";
import { ProcessingIndicator } from "@/components/processing-indicator";
import { SiteFilters } from "@/components/site-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { emptyFilterState, filterEmptyHeading, filterSites, type SiteFilterState } from "@/lib/site-filters";
import type { OverviewRow } from "@/lib/types";

export function SitesView({
  sites,
  loaded,
  onOpenSite,
  onAddSite,
  onRefresh,
}: {
  sites: readonly OverviewRow[];
  loaded: boolean;
  onOpenSite: (siteId: string) => void;
  onAddSite: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<SiteFilterState>(emptyFilterState);
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [scanAllBusy, setScanAllBusy] = useState(false);

  const filteredSites = filterSites(sites, filters);
  const scanning = sites.filter((row) => row.running).length;

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">WordPress Fleet</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {sites.length} sites connected · Automatic health scans &amp; updates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={scanAllBusy}
            onClick={() => {
              void (async () => {
                setScanAllBusy(true);
                try {
                  await api("/api/scan-all", { method: "POST" });
                  toast.message("Scanning all sites");
                  await onRefresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not start scans");
                } finally {
                  setScanAllBusy(false);
                }
              })();
            }}
          >
            {scanAllBusy ? <Spinner size={14} /> : <ScanLineIcon className="size-4" aria-hidden />}
            <span>{scanAllBusy ? "Scanning…" : "Scan all"}</span>
          </Button>

          <Button size="sm" type="button" onClick={onAddSite} className="bg-[#f97316] text-white hover:bg-[#ea580c]">
            <PlusIcon className="size-4 mr-1" />
            <span>Add site</span>
          </Button>
        </div>
      </div>

      {loaded ? (
        sites.length > 0 ? (
          <>
            <FleetStatStrip sites={sites} state={filters} onChange={setFilters} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <SiteFilters sites={sites} state={filters} onChange={setFilters} />
              {scanning > 0 ? (
                <ProcessingIndicator
                  className="font-mono text-xs"
                  label={
                    <>
                      <span className="font-medium text-foreground">{scanning}</span> scanning
                    </>
                  }
                  size={12}
                />
              ) : null}
            </div>
          </>
        ) : null
      ) : (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Main Table or Empty State */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xl">
        {loaded && sites.length === 0 ? (
          <EmptyState
            className="my-12 px-6"
            title="No sites connected yet"
            description="Add a WordPress site using an Application Password from Users → Profile. No monitoring plugins required on the WordPress site."
            action={
              <Button onClick={onAddSite} className="bg-[#f97316] text-white hover:bg-[#ea580c]">
                Connect your first site
              </Button>
            }
          />
        ) : (
          <>
            <div className="fleet-desktop">
              <FleetTable
                sites={filteredSites}
                loaded={loaded}
                selectedIds={selection}
                onSelectionChange={setSelection}
                onOpen={onOpenSite}
              />
            </div>
            <div className="fleet-mobile p-4">
              <FleetCards sites={filteredSites} loaded={loaded} onOpen={onOpenSite} />
            </div>
            {loaded && filteredSites.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  title={filterEmptyHeading(filters)}
                  action={
                    <Button
                      type="button"
                      variant="link"
                      className="text-[#f97316]"
                      onClick={() => setFilters(emptyFilterState())}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <FleetSelectionBar
        sites={sites}
        selectedIds={selection}
        onClear={() => setSelection(new Set())}
        onChanged={onRefresh}
      />
    </div>
  );
}
