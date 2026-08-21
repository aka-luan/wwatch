import { useState } from "react";
import {
  GlobeIcon,
  LockIcon,
  ServerIcon,
  ShieldCheckIcon,
  WrenchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ArchitectureDiagram() {
  const [activeTab, setActiveTab] = useState<"standard" | "helper">("standard");

  return (
    <section id="architecture" className="relative border-t border-border bg-raised/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            ARCHITECTURE & EXTENSIBILITY
          </span>
          <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Monitor WordPress without installing another plugin.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Standard monitoring runs entirely through WordPress Core REST and direct HTTP probes. The optional helper
            plugin is only needed for actions core REST cannot perform.
          </p>
        </div>

        {/* Architecture Toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setActiveTab("standard")}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                activeTab === "standard"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Standard Monitoring (Zero Plugins)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("helper")}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                activeTab === "helper"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              + Optional Helper (Updates & Actions)
            </button>
          </div>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="mt-12 rounded-xl border border-border bg-card p-6 sm:p-10 shadow-2xl">
          <div className="grid gap-8 lg:grid-cols-3 lg:items-center">
            {/* Box 1: wwatch Controller */}
            <div className="rounded-xl border border-border bg-raised/60 p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="rounded-md border border-border bg-muted/60 p-2 text-ring">
                    <ServerIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-[15px]">wwatch Engine</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">Scheduler & Storage</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-2 font-mono text-[12px] text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span>Single Node binary or Vercel Cron</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span>Local SQLite or Turso DB</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span>Encrypted Application Passwords</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <span className="font-mono text-[11px] text-ring">HTTPS REST Requests →</span>
              </div>
            </div>

            {/* Middle: Protocol Pipeline */}
            <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
              <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-muted-foreground bg-raised/80 px-3 py-1.5 rounded-full border border-border">
                <LockIcon className="size-3 text-success" />
                <span>Basic Auth (Application Password)</span>
              </div>

              {/* Protocol Flow lines */}
              <div className="w-full flex flex-col items-center gap-2 py-2 font-mono text-[11px]">
                <div className="w-full rounded border border-border/80 bg-raised/40 p-2.5 text-left">
                  <span className="text-success font-semibold">GET /wp-json</span>
                  <p className="text-muted-foreground text-[11px]">Detects core version & namespaces</p>
                </div>
                <div className="w-full rounded border border-border/80 bg-raised/40 p-2.5 text-left">
                  <span className="text-success font-semibold">GET /wp/v2/plugins</span>
                  <p className="text-muted-foreground text-[11px]">Audits plugin versions & active status</p>
                </div>
                <div className="w-full rounded border border-border/80 bg-raised/40 p-2.5 text-left">
                  <span className="text-warning font-semibold">HEAD /debug.log</span>
                  <p className="text-muted-foreground text-[11px]">Probes public file exposures</p>
                </div>
              </div>
            </div>

            {/* Box 2: Target WordPress Site */}
            <div className="rounded-xl border border-border bg-raised/60 p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="rounded-md border border-border bg-muted/60 p-2 text-success">
                    <GlobeIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-[15px]">Your WordPress Site</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">Standard Installation</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {/* Layer A: Core REST */}
                  <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-[12px]">
                    <div className="flex items-center gap-1.5 font-semibold text-success">
                      <ShieldCheckIcon className="size-4" />
                      <span>Native Core REST API (0 Plugins)</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Handles all status checks, plugin versions, theme versions, Site Health tests, and link crawls.
                    </p>
                  </div>

                  {/* Layer B: Optional Helper */}
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-[12px] transition-all",
                      activeTab === "helper"
                        ? "border-ring/50 bg-ring/10 ring-1 ring-ring/30"
                        : "border-border bg-raised/40 opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <WrenchIcon className="size-4 text-warning" />
                      <span>Optional wwatch Helper (v1.3.0)</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Adds one-click plugin/theme/core updates, one-time 30s wp-admin logins, and allowlisted file repairs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
