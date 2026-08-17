import type { ReactNode } from "react";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE_STATUS_LABEL, STATUS_BADGE_VARIANT, type SiteStatus } from "@/lib/status";
import { TONE_SURFACE, toneOf, type Tone } from "@/lib/tone";

export type { SiteStatus };

type StatusBadgeProps = {
  status?: SiteStatus;
  /** Use when the accent comes from a severity rather than a site status. */
  tone?: Tone;
  children?: ReactNode;
  className?: string;
  dot?: boolean;
};

/**
 * A dot and a word. Color is the accent on the dot and the text, with only a wash of it
 * behind them, so a screen of these never turns into a screen of color.
 */
export function StatusBadge({ status, tone, children, className, dot = true }: StatusBadgeProps) {
  const resolved = tone ?? toneOf(status ?? "unknown");
  const label = children ?? (status ? SITE_STATUS_LABEL[status] : null);
  return (
    <Badge
      variant={status ? STATUS_BADGE_VARIANT[status] : "secondary"}
      data-status={status}
      data-tone={resolved}
      className={cn(
        "h-5 gap-1.5 rounded-full border px-2 py-0 text-[12px] font-medium",
        TONE_SURFACE[resolved],
        className,
      )}
    >
      {dot ? <StatusDot tone={resolved} decorative className="size-1.5" /> : null}
      {label}
    </Badge>
  );
}
