import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GithubIcon } from "./icons";
import { cn } from "@/lib/utils";

export function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-card py-24 sm:py-32">
      {/* Background Technical Grid */}
      <div
        className="pointer-events-none absolute inset-0 z-0 tech-grid grid-mask-radial opacity-50"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          CONSOLIDATED WORDPRESS FLEET OPERATIONS
        </span>

        <h2 className="mt-4 font-sans text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Stop checking WordPress sites one by one.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Get continuous visibility into updates, certificate expirations, sensitive file exposures, and Site Health
          across your entire WordPress portfolio in one dashboard.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/app"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "h-12 gap-2 px-6 text-sm font-semibold shadow-lg shadow-black/40",
            )}
          >
            <span>Start watching your sites</span>
            <ArrowRightIcon className="size-4" />
          </a>
          <a
            href="https://github.com/aka-luan/wwatch"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 gap-2 border-border bg-card/60 px-6 text-sm font-medium text-foreground hover:bg-muted/60",
            )}
          >
            <GithubIcon className="size-4" />
            <span>View on GitHub →</span>
          </a>
        </div>

        <p className="mt-8 font-mono text-[12px] text-muted-foreground">
          Open source · Self-hostable · No monitoring plugin required
        </p>
      </div>
    </section>
  );
}
