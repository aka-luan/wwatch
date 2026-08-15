import { cn } from "@/lib/utils";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/status";

export type { SiteStatus };

const STATUS_DOT_CLASS = {
  critical: "bg-destructive",
  attention: "bg-warning",
  healthy: "bg-success",
  unknown: "bg-muted-foreground/60",
} as const satisfies Record<SiteStatus, string>;

type StatusDotProps = {
  status: SiteStatus;
  className?: string;
} & (
  | { decorative: true; label?: never }
  | { decorative?: false; label?: string }
);

export function StatusDot({ status, className, decorative, label }: StatusDotProps) {
  const text = label ?? SITE_STATUS_LABEL[status];
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[status], className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": text })}
    />
  );
}
