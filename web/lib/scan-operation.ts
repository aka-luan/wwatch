import type { Finding, OverviewRow, ScanSnapshot, ScanSummary, SitePage } from "./types";

export type ScanStage = {
  label: string;
  done?: number;
  total?: number;
};

export type ScanOperationState =
  | { kind: "idle" }
  | { kind: "running"; stage: ScanStage | null; showingFrom: string | null }
  | { kind: "failed"; lastSuccessfulAt: string | null; detail: string | null };

/** True when the latest completed snapshot is a reachability / hard scan failure. */
export function isScanFailure(latest: ScanSnapshot | null): boolean {
  if (!latest) {
    return false;
  }
  if (latest.rollup === "down") {
    return true;
  }
  return latest.findings.some(isDownFinding);
}

function isDownFinding(finding: Finding): boolean {
  return finding.kind === "down";
}

/**
 * Most recent finishedAt that is not a hard scan failure.
 * When the latest scan failed, prefer an earlier successful history entry.
 */
export function lastSuccessfulFinishedAt(page: {
  latest: ScanSnapshot | null;
  history?: readonly ScanSummary[];
}): string | null {
  if (page.latest && !isScanFailure(page.latest)) {
    return page.latest.finishedAt;
  }
  for (const scan of page.history ?? []) {
    if (page.latest && scan.id === page.latest.id) {
      continue;
    }
    if (scan.rollup !== "down") {
      return scan.finishedAt;
    }
  }
  return null;
}

export function scanFailureDetail(latest: ScanSnapshot | null): string | null {
  if (!latest) {
    return null;
  }
  const down = latest.findings.find(isDownFinding);
  if (!down) {
    return null;
  }
  if (down.detail && down.detail !== down.title) {
    return down.detail;
  }
  return null;
}

/**
 * Stage labels only when the API supplies real progress.
 * Jobs today only expose { id, startedAt }, so this stays null.
 */
export function scanStageOf(_running: OverviewRow["running"]): ScanStage | null {
  return null;
}

export type ScanOperationInput = Pick<OverviewRow, "latest" | "running"> & {
  history?: readonly ScanSummary[];
};

export function scanOperationOf(row: ScanOperationInput): ScanOperationState {
  if (row.running) {
    return {
      kind: "running",
      stage: scanStageOf(row.running),
      showingFrom: row.latest?.finishedAt ?? null,
    };
  }
  if (isScanFailure(row.latest)) {
    return {
      kind: "failed",
      lastSuccessfulAt: lastSuccessfulFinishedAt(row),
      detail: scanFailureDetail(row.latest),
    };
  }
  return { kind: "idle" };
}

export function scanningLabel(stage: ScanStage | null): string {
  if (!stage) {
    return "Scanning";
  }
  if (
    typeof stage.done === "number" &&
    typeof stage.total === "number" &&
    stage.total > 0 &&
    stage.done >= 0
  ) {
    return `${capitalize(stage.label)} · ${stage.done}/${stage.total}`;
  }
  return `Scanning · ${stage.label}`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function sitePageFromOverview(row: OverviewRow, previous?: SitePage | null): SitePage {
  if (previous && previous.site.id === row.site.id) {
    return {
      ...row,
      username: previous.username,
      history: previous.history,
    };
  }
  return {
    ...row,
    username: "",
    history: [],
  };
}
