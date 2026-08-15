import type { ReactNode } from "react";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE_STATUS_LABEL, STATUS_BADGE_VARIANT, type SiteStatus } from "@/lib/status";

export type { SiteStatus };

type StatusBadgeProps = {
  status: SiteStatus;
  children?: ReactNode;
  className?: string;
  dot?: boolean;
};

export function StatusBadge({ status, children, className, dot = true }: StatusBadgeProps) {
  const label = children ?? SITE_STATUS_LABEL[status];
  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status]}
      data-status={status}
      className={cn(
        "h-5 gap-1 rounded-md px-1.5 py-0 text-[11px] font-medium tracking-wide",
        "ring-1 ring-current/20 ring-inset",
        className,
      )}
    >
      {dot ? <StatusDot status={status} decorative className="size-1.5" /> : null}
      {label}
    </Badge>
  );
}
