import type { ReactNode } from "react";

import { TONE_ACCENT, TONE_RAIL_STRONG, type Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

type MetricProps = {
  value: ReactNode;
  label: ReactNode;
  tone?: Tone;
  className?: string;
};

/**
 * A number and what it counts. Numerals are mono + tabular so a polling update never
 * shifts the layout under the cursor.
 */
export function Metric({ value, label, tone = "neutral", className }: MetricProps) {
  return (
    <div data-slot="metric" className={cn("flex flex-col gap-1", className)}>
      <MetricValue tone={tone}>{value}</MetricValue>
      <MetricLabel>{label}</MetricLabel>
    </div>
  );
}

export function MetricValue({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "font-mono text-[22px] leading-none font-semibold tabular-nums",
        TONE_ACCENT[tone],
      )}
    >
      {children}
    </span>
  );
}

export function MetricLabel({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "text-[12px] leading-4 font-normal",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** The underline a metric grows when it doubles as an active filter. */
export function metricRail(tone: Tone, active: boolean): string {
  return cn("border-b-2", active ? TONE_RAIL_STRONG[tone] : "border-transparent");
}
