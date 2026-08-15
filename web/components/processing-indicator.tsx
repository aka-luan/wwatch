import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ProcessingIndicatorProps = {
  label: ReactNode;
  detail?: ReactNode;
  className?: string;
  size?: number;
};

/**
 * Shared inline processing cue for scans, button waits, and later remediation.
 * Renders an icon-sized spinner plus accessible text. No giant loaders.
 */
export function ProcessingIndicator({ label, detail, className, size = 14 }: ProcessingIndicatorProps) {
  const text =
    detail == null || detail === "" ? (
      label
    ) : (
      <>
        {label}
        <span aria-hidden> · </span>
        {detail}
      </>
    );

  return (
    <span
      role="status"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-[13px] leading-5 text-muted-foreground",
        className,
      )}
    >
      <Spinner size={size} className="shrink-0 text-current" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
    </span>
  );
}
