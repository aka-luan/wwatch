/**
 * Building blocks shared by the site page (and reused wherever a finding needs an action).
 * Formerly site-row.tsx, which owned the inline row expansion the redesign replaced with
 * a dedicated site page.
 */
import { type ReactNode } from "react";
import { DownloadIcon, PuzzleIcon } from "lucide-react";
import { RowAction } from "@/components/finding-row";
import { ProcessingIndicator } from "@/components/processing-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/status-badge";
import { type DisplayFinding } from "@/lib/finding-groups";
import { agoWords, formatScanWhen } from "@/lib/format";
import { helperCan, isRepairablePath } from "@/lib/helper";
import { scanningLabel, type ScanOperationState } from "@/lib/scan-operation";
import type { Finding, HelperInfo, InstalledPlugin } from "@/lib/types";

export type ConfirmJob = {
  title: string;
  description: string;
  run: () => Promise<void>;
  action: string;
};

export function ScanOperationBanner({
  operation,
  scanning,
  historyReady,
  onRetry,
  retryBusy,
}: {
  operation: ScanOperationState;
  scanning: boolean;
  historyReady: boolean;
  onRetry: () => void;
  retryBusy: boolean;
}) {
  if (scanning || operation.kind === "running") {
    const stage = operation.kind === "running" ? operation.stage : null;
    const showingFrom = operation.kind === "running" ? operation.showingFrom : null;
    return (
      <div className="space-y-0.5" aria-live="polite">
        <ProcessingIndicator label={`${scanningLabel(stage)}…`} />
        {showingFrom ? (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Showing results from {formatScanWhen(showingFrom)}
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">Waiting for the first result.</p>
        )}
      </div>
    );
  }

  if (operation.kind !== "failed") {
    return null;
  }

  const lastSuccessfulCopy = operation.lastSuccessfulAt
    ? `Last successful result from ${agoWords(operation.lastSuccessfulAt)}.`
    : historyReady
      ? "No earlier successful result yet."
      : null;

  return (
    <div
      className="space-y-1 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5"
      aria-live="polite"
    >
      <p className="m-0 text-sm font-medium text-destructive">Scan failed</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lastSuccessfulCopy ? (
          <p className="min-w-0 text-[13px] leading-5 text-muted-foreground">{lastSuccessfulCopy}</p>
        ) : (
          <span className="min-w-0" />
        )}
        <Button variant="outline" size="xs" type="button" disabled={retryBusy} aria-busy={retryBusy} onClick={onRetry}>
          {retryBusy ? <Spinner size={12} /> : null}
          Retry
        </Button>
      </div>
      {operation.detail ? (
        <p className="text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{operation.detail}</p>
      ) : null}
    </div>
  );
}

/**
 * What the board could do here if the plugin were installed or current. Guidance, not a
 * finding, so it renders as a quiet callout with the download as its one action.
 */
export function HelperHelp({ helper, className }: { helper: HelperInfo | null; className?: string }) {
  const copy = !helper || helper.kind === "missing"
    ? "Install the wwatch plugin to manage WordPress directly from wwatch — open WP Admin, update, or fix findings from the board."
    : !helperCan(helper, "update")
      ? "This plugin can log in. Download the current wwatch plugin to update or fix findings from the board."
      : !helperCan(helper, "repair")
        ? "This plugin can log in and update. Download the current wwatch plugin to fix exposed files from the board."
        : null;

  if (!copy) {
    return null;
  }

  return (
    <Callout
      className={className}
      icon={<PuzzleIcon className="size-4" aria-hidden />}
      action={
        <Button
          variant="outline"
          size="xs"
          nativeButton={false}
          render={<a href="/api/helper-plugin" />}
        >
          <DownloadIcon />
          Get the plugin
        </Button>
      }
    >
      {copy}
    </Callout>
  );
}

export function rowAction(
  item: DisplayFinding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: ConfirmJob) => void,
  applyHelper: (path: string, body: unknown, failed: string) => Promise<void>,
): ReactNode {
  if (item.findings.length !== 1) {
    return undefined;
  }
  const finding = item.findings[0];
  if (!finding) {
    return undefined;
  }
  return findingAction(finding, helper, siteName, confirm, applyHelper);
}

function findingAction(
  finding: Finding,
  helper: HelperInfo | null,
  siteName: string,
  confirm: (job: ConfirmJob) => void,
  applyHelper: (path: string, body: unknown, failed: string) => Promise<void>,
) {
  if (helperCan(helper, "update")) {
    if (finding.kind === "plugin_update" && finding.plugin) {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Update ${finding.title}?`,
              description: `Update ${finding.title} on ${siteName}?`,
              action: "Update",
              run: () => applyHelper("/update", { kind: "plugin", plugin: finding.plugin }, "Could not update"),
            })
          }
        >
          Update
        </RowAction>
      );
    }
    if (finding.kind === "theme_update" && finding.theme) {
      return (
        <RowAction
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
        </RowAction>
      );
    }
    if (finding.kind === "core_update") {
      return (
        <RowAction
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
        </RowAction>
      );
    }
  }
  if (helperCan(helper, "repair")) {
    if (finding.kind === "xmlrpc_open") {
      return (
        <RowAction
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
        </RowAction>
      );
    }
    if (finding.kind === "exposed_path" && isRepairablePath(finding.path)) {
      return (
        <RowAction
          type="button"
          onClick={() =>
            confirm({
              title: `Delete ${finding.path}?`,
              description: `Delete ${finding.path} on ${siteName}?`,
              action: "Fix",
              run: () => applyHelper("/repair", { kind: "exposed_path", path: finding.path }, "Could not repair"),
            })
          }
        >
          Fix
        </RowAction>
      );
    }
  }
  return undefined;
}

export function PluginRow({
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
  const update = findings.find((item) => item.kind === "plugin_update" && item.plugin === plugin.ref);
  const next = plugin.status === "active" ? "inactive" : "active";
  return (
    <div className="flex flex-col gap-2 border-t border-hairline px-3.5 py-2.5 transition-colors first:border-t-0 hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 [overflow-wrap:anywhere]">
          <span className="font-medium">{plugin.name}</span>
          {plugin.status === "inactive" ? (
            <Badge variant="secondary" className="h-5 px-2 text-[11px] font-medium">
              Inactive
            </Badge>
          ) : null}
          {update ? (
            <StatusBadge status="attention" dot={false} className="font-mono">
              {plugin.version} → {update.latest}
            </StatusBadge>
          ) : (
            <span className="font-mono text-[12px] text-muted-foreground">{plugin.version}</span>
          )}
        </p>
        <p className="font-mono text-[12px] leading-4 text-muted-foreground/80">{plugin.ref}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canUpdate && update ? (
          <RowAction type="button" onClick={() => onUpdate({ plugin: plugin.ref, name: plugin.name })}>
            Update
          </RowAction>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onToggle({ plugin: plugin.ref, name: plugin.name, status: next })}
        >
          Set {next}
        </Button>
      </div>
    </div>
  );
}
