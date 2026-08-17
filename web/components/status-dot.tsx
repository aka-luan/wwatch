import { cn } from "@/lib/utils";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/status";
import { TONE_DOT, toneOf, type Tone } from "@/lib/tone";

export type { SiteStatus };

type StatusDotProps = {
  status?: SiteStatus;
  tone?: Tone;
  className?: string;
} & ({ decorative: true; label?: never } | { decorative?: false; label?: string });

export function StatusDot({ status, tone, className, decorative, label }: StatusDotProps) {
  const resolved = tone ?? toneOf(status ?? "unknown");
  const text = label ?? (status ? SITE_STATUS_LABEL[status] : resolved);
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", TONE_DOT[resolved], className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": text })}
    />
  );
}
