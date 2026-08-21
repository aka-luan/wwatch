import { ArrowRightIcon, TerminalIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GithubIcon } from "./icons";
import { HeroProductVisual } from "./hero-product-visual";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32">
      {/* Background Technical Grid with Radial Mask */}
      <div
        className="pointer-events-none absolute inset-0 z-0 tech-grid grid-mask-radial opacity-60"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Top Editorial Layout */}
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-8">
          {/* Left Column: Typography & CTAs */}
          <div className="lg:col-span-5 lg:pt-4">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded border border-border/80 bg-muted/40 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              <span>OPEN-SOURCE WORDPRESS OPERATIONS</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 font-sans text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[54px] lg:leading-[1.05]">
              Every WordPress site.{" "}
              <span className="block text-muted-foreground/80 font-normal">One place to watch.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Monitor updates, broken links, TLS certificates, exposed sensitive files, reachability, and Site Health
              across your entire fleet. Without installing another agent on every site.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/app"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-11 gap-2 px-5 text-sm font-semibold shadow-lg shadow-black/40",
                )}
              >
                <span>Get started</span>
                <ArrowRightIcon className="size-4" />
              </a>
              <a
                href="https://github.com/aka-luan/wwatch"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 gap-2 border-border bg-card/60 px-5 text-sm font-medium text-foreground hover:bg-muted/60",
                )}
              >
                <GithubIcon className="size-4" />
                <span>View on GitHub →</span>
              </a>
            </div>

            {/* Technical Subtext & Badges */}
            <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-4">
              <p className="font-mono text-[12px] text-muted-foreground/90">
                Self-hostable · Open source · No monitoring plugin required
              </p>
              <div className="flex items-center gap-4 text-[12px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <TerminalIcon className="size-3.5 text-ring" />
                  <span>Single Node binary or Vercel + Turso</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Fleet Console */}
          <div className="lg:col-span-7">
            <HeroProductVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
