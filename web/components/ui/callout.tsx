import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type CalloutProps = {
  icon?: ReactNode;
  /** Trailing slot for the one action the guidance points at. */
  action?: ReactNode;
} & ComponentProps<"div">;

/**
 * Contextual guidance: a hint that belongs to the content above it rather than a finding
 * of its own. Deliberately quieter than a Card — the raised surface and a hairline, no
 * accent color — so it reads as an aside and never competes with a real status.
 */
export function Callout({ icon, action, children, className, ...props }: CalloutProps) {
  return (
    <div
      data-slot="callout"
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-hairline bg-raised px-3.5 py-2.5",
        "text-[13px] leading-5 text-muted-foreground",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 text-muted-foreground/80">{icon}</span> : null}
      <p className="m-0 min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</p>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
