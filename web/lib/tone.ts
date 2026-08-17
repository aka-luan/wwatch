import type { Severity, SiteStatus } from "./status.ts";

/**
 * The presentation-layer accent. `SiteStatus` is derived domain data and `Severity`
 * comes from the scanner; `Tone` is what the UI paints with. Keeping it separate means
 * a purely informational accent (blue) exists without inventing a fifth site status.
 *
 * Everything that colors by status goes through the maps below, so there is exactly one
 * place where an accent is defined. Alpha convention: /10 fill, /25 border, full text.
 */
export const TONES = ["critical", "warning", "healthy", "info", "neutral"] as const;

export type Tone = (typeof TONES)[number];

export const TONE_FROM_STATUS = {
  critical: "critical",
  attention: "warning",
  healthy: "healthy",
  unknown: "neutral",
} as const satisfies Record<SiteStatus, Tone>;

export const TONE_FROM_SEVERITY = {
  crit: "critical",
  warn: "warning",
  info: "info",
} as const satisfies Record<Severity, Tone>;

export function toneOf(status: SiteStatus): Tone {
  return TONE_FROM_STATUS[status];
}

/** Background for the small status dot. */
export const TONE_DOT = {
  critical: "bg-destructive",
  warning: "bg-warning",
  healthy: "bg-success",
  info: "bg-ring",
  neutral: "bg-muted-foreground/60",
} as const satisfies Record<Tone, string>;

/** Accent text. Healthy and neutral stay muted so only problems draw the eye. */
export const TONE_TEXT = {
  critical: "font-medium text-destructive",
  warning: "font-medium text-warning",
  healthy: "text-muted-foreground",
  info: "text-muted-foreground",
  neutral: "text-muted-foreground",
} as const satisfies Record<Tone, string>;

/** Accent text that always carries its color, for numerals and single values. */
export const TONE_ACCENT = {
  critical: "text-destructive",
  warning: "text-warning",
  healthy: "text-success",
  info: "text-ring",
  neutral: "text-muted-foreground",
} as const satisfies Record<Tone, string>;

/**
 * Border color for a rail (left edge of a row, underline of a filter). Only the two
 * problem tones get a color; a green rail on every healthy row would be a wall of color.
 */
export const TONE_RAIL = {
  critical: "border-destructive",
  warning: "border-warning",
  healthy: "border-border",
  info: "border-border",
  neutral: "border-border",
} as const satisfies Record<Tone, string>;

/**
 * The same rail drawn as an inset shadow, for elements whose border-color is already
 * spoken for — a <tr> in a collapsed table cannot carry a left border at all, and on a
 * card the border shorthand would tint the bottom hairline too.
 */
export const TONE_RAIL_INSET = {
  critical: "shadow-[inset_3px_0_0_var(--destructive)]",
  warning: "shadow-[inset_3px_0_0_var(--warning)]",
  healthy: "shadow-[inset_3px_0_0_var(--border)]",
  info: "shadow-[inset_3px_0_0_var(--border)]",
  neutral: "shadow-[inset_3px_0_0_var(--border)]",
} as const satisfies Record<Tone, string>;

/**
 * Rail for a rail that marks a *selection* rather than a severity, so it has to stay
 * visible even for the calm tones.
 */
export const TONE_RAIL_STRONG = {
  critical: "border-destructive",
  warning: "border-warning",
  healthy: "border-success",
  info: "border-ring",
  neutral: "border-foreground",
} as const satisfies Record<Tone, string>;

/** Tinted surface for pills and chips: a wash, never a saturated block. */
export const TONE_SURFACE = {
  critical: "bg-destructive/10 text-destructive border-destructive/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  healthy: "bg-success/10 text-success border-success/25",
  info: "bg-ring/10 text-ring border-ring/25",
  neutral: "bg-muted text-muted-foreground border-border",
} as const satisfies Record<Tone, string>;
