import type { ReactNode } from "react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { SiteStatus } from "@/lib/status";

type FindingRowProps = {
  status: SiteStatus;
  title: string;
  detail?: string;
  action?: ReactNode;
  statusLabel?: string;
};

export function FindingRow({ status, title, detail, action, statusLabel }: FindingRowProps) {
  return (
    <div className={cn("finding flex items-start justify-between gap-3", action && "has-action")}>
      <div>
        <StatusBadge status={status}>{statusLabel}</StatusBadge> <strong>{title}</strong>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}
