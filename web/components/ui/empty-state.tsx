import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** `inline` is a single muted line inside a section; `block` owns the page area. */
  size?: "inline" | "block";
} & Omit<ComponentProps<"div">, "title">;

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "block",
  className,
  ...props
}: EmptyStateProps) {
  if (size === "inline") {
    return (
      <div
        data-slot="empty-state"
        className={cn("flex items-center gap-2 py-2.5 text-sm text-muted-foreground", className)}
        {...props}
      >
        {icon}
        {title}
        {action}
      </div>
    );
  }

  return (
    <div
      data-slot="empty-state"
      className={cn("max-w-[36rem] text-muted-foreground", className)}
      {...props}
    >
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      {title ? (
        <h2 className="m-0 text-[15px] leading-5 font-semibold text-foreground">{title}</h2>
      ) : null}
      {description ? <p className="m-0 mt-1.5 text-[13px] leading-5">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
