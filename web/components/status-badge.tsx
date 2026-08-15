import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE_STATUS_LABEL, STATUS_BADGE_VARIANT, type SiteStatus } from "@/lib/status";

export type { SiteStatus };

type StatusBadgeProps = {
  status: SiteStatus;
  children?: ReactNode;
  className?: string;
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const label = children ?? SITE_STATUS_LABEL[status];
  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status]}
      className={cn(
        "h-auto px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
