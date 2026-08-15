import { EmptyNote } from "@/components/finding-row";
import { StatusDot } from "@/components/status-dot";
import { timelineWhen } from "@/lib/format";
import { scanHistoryEntries, scansForTimeline, type ScanHistoryEntry } from "@/lib/scan-history";
import type { SitePage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact newest-first history. Scanning chrome lives on the sheet banner, not here. */
export function ScanTimeline({ page }: { page: Pick<SitePage, "latest" | "history"> }) {
  const entries = scanHistoryEntries(scansForTimeline(page));
  if (entries.length === 0) {
    return <EmptyNote>No scans yet.</EmptyNote>;
  }

  return (
    <ol className="m-0 list-none p-0" aria-label="Scan history, newest first">
      {entries.map((entry, index) => (
        <ScanTimelineItem key={entry.scan.id} entry={entry} last={index === entries.length - 1} />
      ))}
    </ol>
  );
}

function ScanTimelineItem({ entry, last }: { entry: ScanHistoryEntry; last: boolean }) {
  const failed = entry.outcome === "failed";
  const when = timelineWhen(entry.scan.finishedAt);
  const outcome = failed ? "Scan failed" : "Scan completed";

  return (
    <li className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2.5">
      <div className="relative flex justify-center pt-1">
        <StatusDot
          status={failed ? "critical" : (entry.status ?? "healthy")}
          decorative
          className="size-2"
        />
        {last ? null : (
          <span className="absolute top-[0.7rem] bottom-0 w-px bg-border" aria-hidden />
        )}
      </div>
      <div className={cn("min-w-0", last ? "pb-0" : "pb-3")}>
        <p className="text-[13px] leading-5 text-foreground">
          <time dateTime={entry.scan.finishedAt}>{when}</time>
        </p>
        <p className={cn("text-[13px] leading-5", failed ? "text-destructive" : "text-muted-foreground")}>
          {outcome}
        </p>
        {entry.countsLine ? (
          <p className="text-[13px] leading-5 text-muted-foreground">{entry.countsLine}</p>
        ) : null}
        {entry.changes.map((change) => (
          <p key={change.kind} className="text-[12px] leading-4 text-muted-foreground">
            <span className="sr-only">{change.spoken}</span>
            <span aria-hidden="true">{change.text}</span>
          </p>
        ))}
      </div>
    </li>
  );
}
