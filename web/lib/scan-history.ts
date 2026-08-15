import { isUpdateFinding } from "./primary-finding";
import { siteStatusFromCounts, type SiteStatus } from "./status";
import type { ScanSnapshot, ScanSummary } from "./types";

export type ScanChange = {
  kind: "critical" | "issues" | "updates";
  delta: number;
  text: string;
  spoken: string;
};

export type ScanHistoryEntry = {
  scan: ScanSummary;
  outcome: "completed" | "failed";
  status: SiteStatus | null;
  countsLine: string | null;
  changes: ScanChange[];
};

export function isIncompleteScan(scan: Pick<ScanSummary, "rollup">): boolean {
  return scan.rollup === "down" || scan.rollup === "auth_failed";
}

export function isComparableScan(scan: Pick<ScanSummary, "rollup">): boolean {
  return scan.rollup === "ok" || scan.rollup === "degraded";
}

export function previousComparableScan(
  history: readonly ScanSummary[],
  index: number,
): ScanSummary | null {
  for (let i = index + 1; i < history.length; i += 1) {
    const scan = history[i];
    if (scan && isComparableScan(scan)) {
      return scan;
    }
  }
  return null;
}

export function scansForTimeline(page: {
  latest: ScanSnapshot | null;
  history?: readonly ScanSummary[];
}): ScanSummary[] {
  if (page.history && page.history.length > 0) {
    return [...page.history];
  }
  if (page.latest) {
    return [scanSummaryFromSnapshot(page.latest)];
  }
  return [];
}

export function scanSummaryFromSnapshot(snapshot: ScanSnapshot): ScanSummary {
  const counts = { crit: 0, warn: 0, info: 0, updates: 0 };
  for (const finding of snapshot.findings) {
    counts[finding.severity] += 1;
    if (isUpdateFinding(finding)) {
      counts.updates += 1;
    }
  }
  return {
    id: snapshot.id,
    finishedAt: snapshot.finishedAt,
    rollup: snapshot.rollup,
    counts,
  };
}

export function scanHistoryEntries(history: readonly ScanSummary[]): ScanHistoryEntry[] {
  return history.map((scan, index) => {
    if (isIncompleteScan(scan)) {
      return {
        scan,
        outcome: "failed",
        status: null,
        countsLine: null,
        changes: [],
      };
    }
    const previous = previousComparableScan(history, index);
    return {
      scan,
      outcome: "completed",
      status: siteStatusFromCounts(scan.counts),
      countsLine: scanCountsLine(scan.counts),
      changes: previous && isComparableScan(scan) ? scanChanges(scan, previous) : [],
    };
  });
}

export function scanCountsLine(counts: ScanSummary["counts"]): string | null {
  const remainingIssues = Math.max(0, counts.warn - counts.updates);
  const parts: string[] = [];
  if (counts.crit > 0) {
    parts.push(counted(counts.crit, "critical"));
  }
  if (remainingIssues > 0) {
    parts.push(counted(remainingIssues, "issue", "issues"));
  }
  if (counts.updates > 0) {
    parts.push(counted(counts.updates, "update", "updates"));
  }
  return parts.length ? parts.join(" · ") : null;
}

export function scanChanges(current: ScanSummary, previous: ScanSummary): ScanChange[] {
  if (!isComparableScan(current) || !isComparableScan(previous)) {
    return [];
  }

  const critDelta = current.counts.crit - previous.counts.crit;
  const issueDelta = actionableCount(current) - actionableCount(previous);
  const updateDelta = current.counts.updates - previous.counts.updates;
  const changes: ScanChange[] = [];

  if (critDelta !== 0) {
    changes.push(
      signedChange({
        kind: "critical",
        delta: critDelta,
        noun: "critical finding",
        nouns: "critical findings",
      }),
    );
  }
  if (issueDelta !== 0 && issueDelta !== critDelta) {
    changes.push(
      signedChange({
        kind: "issues",
        delta: issueDelta,
        noun: "issue",
        nouns: "issues",
      }),
    );
  }
  if (updateDelta < 0) {
    const amount = -updateDelta;
    const noun = amount === 1 ? "update" : "updates";
    changes.push({
      kind: "updates",
      delta: updateDelta,
      text: `${amount} ${noun} resolved`,
      spoken: `${amount} ${noun} resolved since the previous comparable scan`,
    });
  } else if (updateDelta > 0) {
    changes.push(
      signedChange({
        kind: "updates",
        delta: updateDelta,
        noun: "update",
        nouns: "updates",
      }),
    );
  }

  return changes;
}

function actionableCount(scan: ScanSummary): number {
  return scan.counts.crit + scan.counts.warn;
}

function signedChange({
  kind,
  delta,
  noun,
  nouns,
}: {
  kind: ScanChange["kind"];
  delta: number;
  noun: string;
  nouns: string;
}): ScanChange {
  const amount = Math.abs(delta);
  const word = amount === 1 ? noun : nouns;
  if (delta < 0) {
    return {
      kind,
      delta,
      text: `↓ ${amount} ${word}`,
      spoken: `${amount} fewer ${word} than the previous comparable scan`,
    };
  }
  return {
    kind,
    delta,
    text: `↑ ${amount} ${word}`,
    spoken: `${amount} more ${word} than the previous comparable scan`,
  };
}

function counted(n: number, noun: string, nouns = noun): string {
  return `${n} ${n === 1 ? noun : nouns}`;
}
