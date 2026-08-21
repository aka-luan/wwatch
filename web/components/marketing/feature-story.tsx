import {
  ActivityIcon,
  CheckCircle2Icon,
  HistoryIcon,
  KeyIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { StatusDot } from "@/components/status-dot";

export function FeatureStory() {
  return (
    <div id="features" className="divide-y divide-border overflow-hidden">
      {/* Section 1: FLEET OBSERVABILITY */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Editorial Copy */}
            <div className="lg:col-span-5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                FLEET OBSERVABILITY
              </span>
              <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[36px] lg:leading-tight">
                See what needs attention before your clients do.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                wwatch audits your WordPress fleet in parallel. It aggregates status across versions, available updates,
                certificate lifespans, sensitive file exposures, broken links, and native Site Health diagnostics into a
                single prioritized dashboard.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 font-mono text-[12px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <StatusDot tone="healthy" decorative className="size-1.5" />
                  <span>WordPress Core, Plugin & Theme update tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot tone="warning" decorative className="size-1.5" />
                  <span>Automated TLS expiration window countdown</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot tone="critical" decorative className="size-1.5" />
                  <span>Exposed .git, debug.log, and wp-config backup detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot tone="info" decorative className="size-1.5" />
                  <span>Same-origin broken link crawler (depth 1)</span>
                </div>
              </div>
            </div>

            {/* Visual Interactive: Observability Telemetry Card */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <ActivityIcon className="size-4 text-success" />
                    <span className="font-mono text-[13px] font-semibold text-foreground">Fleet Health Overview</span>
                  </div>
                  <span className="rounded bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    12 Origins Monitored
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-raised/50 p-3">
                    <span className="text-[11px] text-muted-foreground">Core Drift</span>
                    <p className="mt-1 font-mono text-lg font-bold text-foreground">0</p>
                    <span className="text-[11px] text-success">All 6.7.1</span>
                  </div>
                  <div className="rounded-lg border border-border bg-raised/50 p-3">
                    <span className="text-[11px] text-muted-foreground">Pending Updates</span>
                    <p className="mt-1 font-mono text-lg font-bold text-warning">7</p>
                    <span className="text-[11px] text-warning">Across 3 sites</span>
                  </div>
                  <div className="rounded-lg border border-border bg-raised/50 p-3">
                    <span className="text-[11px] text-muted-foreground">TLS Expiring (&lt;30d)</span>
                    <p className="mt-1 font-mono text-lg font-bold text-warning">2</p>
                    <span className="text-[11px] text-warning">11d and 23d left</span>
                  </div>
                  <div className="rounded-lg border border-border bg-raised/50 p-3">
                    <span className="text-[11px] text-muted-foreground">Exposed Files</span>
                    <p className="mt-1 font-mono text-lg font-bold text-destructive">1</p>
                    <span className="text-[11px] text-destructive">debug.log</span>
                  </div>
                </div>

                {/* Micro finding list */}
                <div className="mt-4 space-y-2 rounded-lg border border-border/80 bg-raised/20 p-3 font-mono text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">client-portal.io</span>
                    <StatusBadge status="critical">1 critical</StatusBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">store.example.com</span>
                    <StatusBadge status="attention">3 updates</StatusBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">acme-corp.com</span>
                    <StatusBadge status="healthy">Healthy</StatusBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: SNAPSHOT FORENSICS */}
      <section className="bg-raised/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Visual Interactive: Scan Timeline Preview */}
            <div className="order-2 lg:order-1 lg:col-span-7">
              <div className="rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="size-4 text-ring" />
                    <span className="font-mono text-[13px] font-semibold text-foreground">Scan Snapshot History</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">Origin: store.example.com</span>
                </div>

                {/* Timeline progression */}
                <div className="mt-4 divide-y divide-border font-mono text-[12px]">
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-warning" />
                      <span className="font-medium text-foreground">Today · 14:02 (Snapshot #148)</span>
                    </div>
                    <span className="text-muted-foreground">3 updates · 1 broken link</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-success" />
                      <span className="text-muted-foreground">Yesterday · 06:00 (Snapshot #147)</span>
                    </div>
                    <span className="text-muted-foreground">Healthy (All checks passed)</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-success" />
                      <span className="text-muted-foreground">Aug 16 · 06:00 (Snapshot #146)</span>
                    </div>
                    <span className="text-muted-foreground">Healthy (All checks passed)</span>
                  </div>
                </div>

                {/* Snapshot findings breakdown */}
                <div className="mt-4 rounded-lg border border-border bg-raised/40 p-3.5 text-[12px]">
                  <p className="font-mono text-[11px] text-muted-foreground">DELTA SINCE PREVIOUS SNAPSHOT:</p>
                  <p className="mt-1 text-foreground">
                    + WooCommerce updated on wordpress.org (8.9.1 → 9.2.0)
                  </p>
                  <p className="mt-0.5 text-foreground">
                    + New broken link detected on <span className="font-mono text-ring">/shop/summer-sale</span> (404)
                  </p>
                </div>
              </div>
            </div>

            {/* Editorial Copy */}
            <div className="order-1 lg:order-2 lg:col-span-5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                SNAPSHOT FORENSICS
              </span>
              <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[36px] lg:leading-tight">
                Understand exactly what changed and when.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Each scheduled scan generates an immutable snapshot rather than simply overwriting state. Operators can
                inspect exact findings across time, see what broke after an automated WordPress core update, and verify
                certificate renewals before expiry.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 font-mono text-[12px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" />
                  <span>Immutable historical scan storage in SQLite / Turso</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" />
                  <span>Granular finding state comparison across runs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" />
                  <span>Zero overwrite while in-flight scans progress</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: DIRECT REMEDIATION */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Editorial Copy */}
            <div className="lg:col-span-5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                DIRECT REMEDIATION
              </span>
              <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[36px] lg:leading-tight">
                Fix findings without hunting for credentials.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                When you need to act, wwatch provides direct operational tools. Generate a one-time 30-second wp-admin
                login link, update plugins and themes with one click, or repair exposed files right from the board.
              </p>

              <div className="mt-6 rounded-lg border border-border bg-card p-3.5 text-[12px]">
                <p className="font-semibold text-foreground">How helper execution works:</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Core monitoring needs zero plugins on WordPress. For remediation (updates, magic logins, file deletions),
                  the optional lightweight <code className="font-mono text-ring">wwatch.php</code> helper plugin executes
                  authenticated actions via the WordPress REST namespace.
                </p>
              </div>
            </div>

            {/* Visual Interactive: Action Center Demo */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <WrenchIcon className="size-4 text-warning" />
                    <span className="font-mono text-[13px] font-semibold text-foreground">Site Action Center</span>
                  </div>
                  <span className="font-mono text-[11px] text-success">Helper 1.3.0 Ready</span>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Action 1: WP Admin Link */}
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[13px] text-foreground">One-Time WP Admin Link</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Mints a 30-second single-use token for the Application Password user.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-[12px]">
                      <KeyIcon className="size-3.5" />
                      <span>Open WP Admin</span>
                    </Button>
                  </div>

                  {/* Action 2: Update All Plugins */}
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[13px] text-foreground">Bulk Plugin & Theme Upgrades</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Trigger safe in-place upgrades via helper REST endpoint and verify with an immediate rescan.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-[12px]">
                      <RefreshCwIcon className="size-3.5" />
                      <span>Update all (3)</span>
                    </Button>
                  </div>

                  {/* Action 3: Allowlisted File Repair */}
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[13px] text-foreground">Allowlisted File Repair</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Safely deletes public debug.log or backup wp-config files, and disables XML-RPC.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-[12px]">
                      <WrenchIcon className="size-3.5" />
                      <span>Fix debug.log</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
