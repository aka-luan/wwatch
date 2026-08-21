import { LayersIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";

export function ProblemStatement() {
  return (
    <section className="relative border-y border-border bg-raised/50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Big Editorial Statement */}
          <div className="lg:col-span-7">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              THE OPERATIONAL PROBLEM
            </span>
            <h2 className="mt-4 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[42px] lg:leading-tight">
              WordPress maintenance gets messy when one site becomes twenty.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Operators normally jump between wp-admin dashboards, update screens, uptime services, certificate checks,
              security scanners, spreadsheets, and reactive messages from clients.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              <strong className="text-foreground font-semibold">wwatch consolidates the operational signal.</strong> One
              lightweight board probes your sites via WordPress REST, creates immutable snapshot history, alerts on new
              regressions, and lets you fix issues without juggling 20 tabs.
            </p>
          </div>

          {/* Right Column: 3 Pillar Metric Cards */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-4">
                <div className="rounded-md border border-border bg-muted/60 p-2 text-foreground">
                  <ShieldCheckIcon className="size-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-[15px]">Zero Monitoring Agent</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Connects using standard WordPress Application Passwords. Scans run from the outside via core REST.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-4">
                <div className="rounded-md border border-border bg-muted/60 p-2 text-foreground">
                  <LayersIcon className="size-5 text-ring" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-[15px]">Immutable Scan Snapshots</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Every scheduled run saves a snapshot. Compare current state with historical findings to track drift.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-4">
                <div className="rounded-md border border-border bg-muted/60 p-2 text-foreground">
                  <ZapIcon className="size-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-[15px]">Direct Operator Action</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    One-click updates, one-time 30-second admin login links, and allowlisted file cleanup right from the
                    board.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
