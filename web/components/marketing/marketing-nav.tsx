import { useState } from "react";
import { ArrowRightIcon, MenuIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GithubIcon } from "./icons";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Checks", href: "#checks" },
  { label: "Alerts", href: "#alerts" },
  { label: "Open Source", href: "#open-source" },
  { label: "How It Works", href: "#how-it-works" },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="group flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90"
            aria-label="wwatch homepage"
          >
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span className="font-sans text-[16px] font-bold tracking-tight text-foreground">wwatch</span>
          </a>
          <span className="hidden rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-block">
            v1.3.0 · OSS
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav aria-label="Main Navigation" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="https://github.com/aka-luan/wwatch"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 gap-1.5 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            <GithubIcon className="size-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href="/app"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 gap-1 px-3 text-[13px] font-medium")}
          >
            <span>Open dashboard</span>
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <a
            href="/app"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 px-3 text-[12px]")}
          >
            Dashboard
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen ? (
        <div className="border-b border-border bg-card/95 px-4 py-4 backdrop-blur-lg md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-1 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-border">
              <a
                href="https://github.com/aka-luan/wwatch"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <GithubIcon className="size-4" />
                <span>View on GitHub</span>
              </a>
              <a
                href="/app"
                className={cn(buttonVariants({ variant: "default" }), "h-9 w-full justify-center gap-1.5")}
              >
                <span>Open dashboard</span>
                <ArrowRightIcon className="size-4" aria-hidden />
              </a>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
