import type { ReactNode } from "react";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";
import type { SiteStatus } from "@/lib/status";

type FindingRowProps = {
  status: SiteStatus;
  title: string;
  detail?: string;
  action?: ReactNode;
  statusLabel?: string;
  compact?: boolean;
  showStatus?: boolean;
};

export function FindingRow({
  status,
  title,
  detail,
  action,
  statusLabel,
  compact = false,
  showStatus = true,
}: FindingRowProps) {
  if (compact) {
    return (
      <div className="flex items-start gap-2 py-0.5 text-[13px] leading-5 text-muted-foreground">
        <StatusDot status={status} decorative className="mt-1.5 size-1.5" />
        <p className="min-w-0 [overflow-wrap:anywhere]">
          {title}
          {detail ? <span> · {detail}</span> : null}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3")}>
      <div className="min-w-0">
        {showStatus ? (
          <div className="mb-1">
            <StatusBadge status={status}>{statusLabel}</StatusBadge>
          </div>
        ) : null}
        <p className="font-medium [overflow-wrap:anywhere]">{title}</p>
        {detail ? <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{detail}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
