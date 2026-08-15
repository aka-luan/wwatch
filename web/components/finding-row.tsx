import type { ComponentProps, ReactNode } from "react";
import { ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
    <div
      className={cn(
        "group/finding -mx-2 flex items-start gap-3 rounded-md border-t border-border px-2 py-3",
        "transition-colors hover:bg-muted/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <StatusBadge status={status}>{statusLabel}</StatusBadge>
        <p className="mt-1 font-medium leading-5 [overflow-wrap:anywhere]">{title}</p>
        {detail ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0 self-end">{action}</div> : null}
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
