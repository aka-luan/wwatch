import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { FindingTone } from "@/lib/finding-groups";
import type { SiteStatus } from "@/lib/status";

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
      <div className="flex items-center gap-2 py-0.5 text-[13px] leading-5 text-muted-foreground">
        <CircleCheckIcon className="size-3.5 shrink-0 text-success" aria-hidden />
        <p className="min-w-0 [overflow-wrap:anywhere]">{title}</p>
      </div>
    );
  }

  if (resolved === "update") {
    return (
      <div className="flex items-baseline gap-3 py-1">
        <p className="min-w-0 flex-1 font-medium leading-5 [overflow-wrap:anywhere]">{title}</p>
        {detail ? (
          <p className="mono shrink-0 text-[13px] leading-5 text-muted-foreground">{detail}</p>
        ) : null}
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
    );
  }

  if (resolved === "info") {
    return (
      <div className="flex items-start gap-2 py-1.5 text-[13px] leading-5">
        <span className="mt-0.5 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Info
        </span>
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

  return (
    <div className="flex items-start gap-3 py-2">
      {showStatus ? (
        <StatusBadge status={status} className="mt-0.5 shrink-0">
          {statusLabel}
        </StatusBadge>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-5 [overflow-wrap:anywhere]">{title}</p>
        {explanation ? (
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{explanation}</p>
        ) : null}
        {detail ? <ViewDetails>{detail}</ViewDetails> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">{action}</div> : null}
    </div>
  );
}

function ViewDetails({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="mt-1">
      <CollapsibleTrigger className="group inline-flex cursor-pointer items-center gap-1 rounded-sm text-[13px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
    <p className="flex items-center gap-2 py-2.5 text-sm text-muted-foreground">
      {tone === "positive" ? <CircleCheckIcon className="size-4 text-success" aria-hidden /> : null}
      {children}
    </p>
  );
}
