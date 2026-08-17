import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing slot for a control that belongs to the section, e.g. a button or count. */
  action?: ReactNode;
  /** `section` is the default; `page` is the one-per-page title. */
  level?: "page" | "section";
  as?: "h1" | "h2" | "h3" | "h4";
} & Omit<ComponentProps<"div">, "title">;

/**
 * The single source of heading hierarchy. Replaces the tiny uppercase eyebrows that
 * used to be re-declared at every section: weight and color carry the hierarchy now.
 */
export function SectionHeading({
  title,
  description,
  action,
  level = "section",
  as,
  className,
  ...props
}: SectionHeadingProps) {
  const Tag = as ?? (level === "page" ? "h1" : "h2");
  return (
    <div
      data-slot="section-heading"
      className={cn("flex items-start justify-between gap-3", className)}
      {...props}
    >
      <div className="min-w-0">
        <Tag
          className={cn(
            "m-0 text-foreground",
            level === "page"
              ? "text-[22px] leading-tight font-semibold tracking-[-0.02em]"
              : "text-sm leading-5 font-semibold",
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p className="m-0 mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
