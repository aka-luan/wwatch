import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { FindingTone } from "@/lib/finding-groups";
import type { SiteStatus } from "@/lib/status";
import { TONE_RAIL_INSET, toneOf } from "@/lib/tone";

type FindingRowProps = {
  status: SiteStatus;
  title: string;
  explanation?: string;
  detail?: string;
  action?: ReactNode;
  statusLabel?: string;
  compact?: boolean;
  showStatus?: boolean;
  tone?: FindingTone;
};

export function FindingRow({
  status,
  title,
  explanation,
  detail,
  action,
  statusLabel,
  compact = false,
  showStatus = true,
  tone,
}: FindingRowProps) {
  const resolved = tone ?? (compact ? "positive" : "actionable");

  if (resolved === "positive") {
    return (
      <div
        className="flex items-start gap-2 py-0.5 text-[13px] leading-5 text-muted-foreground"
        data-slot="finding-row"
      >
        <StatusDot status={status} decorative className="mt-1.5 size-1.5" />
        <p className="min-w-0 [overflow-wrap:anywhere]">
          {title}
          {detail ? <span> · {detail}</span> : null}
        </p>
      </div>
    );
  }

  if (resolved === "update") {
    return (
      <div
        className={cn(
          "group/finding flex flex-col gap-2 border-t border-hairline px-3.5 py-2.5 transition-colors first:border-t-0 hover:bg-muted/30",
          "sm:flex-row sm:items-baseline sm:justify-between sm:gap-3",
        )}
        data-slot="finding-row"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="min-w-0 font-medium leading-5 [overflow-wrap:anywhere]">{title}</p>
          {detail ? (
            <p className="shrink-0 font-mono text-[13px] leading-5 text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center self-end sm:self-auto">{action}</div> : null}
      </div>
    );
  }

  if (resolved === "info") {
    return (
      <div
        className="group/finding flex items-start gap-2 border-t border-hairline px-3.5 py-2.5 text-[13px] leading-5 first:border-t-0"
        data-slot="finding-row"
      >
        <StatusDot tone="info" decorative className="mt-1.5 size-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground [overflow-wrap:anywhere]">{title}</p>
          {explanation ? (
            <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground/80 [overflow-wrap:anywhere]">
              {explanation}
            </p>
          ) : null}
          {detail ? <ViewDetails>{detail}</ViewDetails> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center self-start">{action}</div> : null}
      </div>
    );
  }

  /*
   * A finding that needs a decision is its own card: severity reads from the badge and a
   * three-pixel rail on the leading edge, so the surface itself stays neutral instead of
   * turning the page yellow.
   */
  return (
    <article
      className={cn(
        cardVariants(),
        "group/finding gap-2 p-3.5 transition-colors hover:bg-muted/20",
        "sm:flex-row sm:items-start sm:justify-between sm:gap-3",
        TONE_RAIL_INSET[toneOf(status)],
      )}
      data-slot="finding-row"
    >
      <div className="min-w-0 flex-1">
        {showStatus ? (
          <div className="mb-1.5">
            <StatusBadge status={status}>{statusLabel}</StatusBadge>
          </div>
        ) : null}
        <p className="m-0 text-[14px] leading-5 font-semibold [overflow-wrap:anywhere]">{title}</p>
        {explanation ? (
          <p className="m-0 mt-1 text-[13px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {explanation}
          </p>
        ) : null}
        {detail ? <ViewDetails>{detail}</ViewDetails> : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-start">{action}</div>
      ) : null}
    </article>
  );
}

function ViewDetails({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="mt-1">
      <CollapsibleTrigger className="group inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-sm text-[13px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        View details
        <ChevronDownIcon
          className="size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 font-mono text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
          {children}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RowAction({
  className,
  children,
  variant = "ghost",
  size = "sm",
  chevron = false,
  ...props
}: ComponentProps<typeof Button> & { chevron?: boolean }) {
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
      {chevron ? <ChevronRightIcon className="size-4" aria-hidden /> : null}
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
    <EmptyState
      size="inline"
      title={children}
      icon={
        tone === "positive" ? <CircleCheckIcon className="size-4 text-success" aria-hidden /> : null
      }
    />
  );
}
