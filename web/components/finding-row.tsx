import type { ComponentProps, ReactNode } from "react";
import { ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
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
    <div
      className={cn(
        "group/finding flex flex-col gap-2 border-t border-border py-2.5 transition-colors hover:bg-muted/30",
        "sm:flex-row sm:items-start sm:justify-between sm:gap-3",
      )}
    >
      <div className="min-w-0">
        {showStatus ? (
          <div className="mb-1">
            <StatusBadge status={status}>{statusLabel}</StatusBadge>
          </div>
        ) : null}
        <p className="font-medium leading-5 [overflow-wrap:anywhere]">{title}</p>
        {detail ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{detail}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 self-end">{action}</div> : null}
    </div>
  );
}

export function RowAction({
  className,
  children,
  variant = "ghost",
  size = "sm",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "h-7 gap-1 px-2 text-muted-foreground",
        "hover:bg-transparent hover:text-foreground",
        "group-hover/finding:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="size-4" aria-hidden />
    </Button>
  );
}

export function EmptyNote({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive";
}) {
  return (
    <p className="flex items-center gap-2 py-2.5 text-sm text-muted-foreground">
      {tone === "positive" ? <CircleCheckIcon className="size-4 text-success" aria-hidden /> : null}
      {children}
    </p>
  );
}
