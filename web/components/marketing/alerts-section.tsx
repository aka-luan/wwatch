import { CheckCircle2Icon, MailIcon, SendIcon, ShieldAlertIcon } from "lucide-react";

export function AlertsSection() {
  return (
    <section id="alerts" className="border-t border-border bg-raised/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Editorial & Explanation */}
          <div className="lg:col-span-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              INTELLIGENT NOTIFICATIONS
            </span>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Alerts when something changes. Not repeated spam.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              wwatch connects to Telegram and Resend Email to dispatch urgent operational findings. Unlike naive uptime
              checkers, wwatch alerts only when a new down, authentication failure, or sensitive file exposure is detected.
            </p>

            <div className="mt-6 space-y-3 font-mono text-[12px] text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <CheckCircle2Icon className="mt-0.5 size-4 text-success shrink-0" />
                <span>
                  <strong className="text-foreground">Stateful deduplication:</strong> If a warning exists across 10 scans,
                  you are only alerted when it first appears or worsens.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2Icon className="mt-0.5 size-4 text-success shrink-0" />
                <span>
                  <strong className="text-foreground">Telegram Bot:</strong> Instant notifications delivered directly to
                  your ops channel.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2Icon className="mt-0.5 size-4 text-success shrink-0" />
                <span>
                  <strong className="text-foreground">Resend Email:</strong> Clean, structured HTML summaries for team
                  inboxes.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Preview of Telegram & Email Alerts */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Telegram Notification Mock */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-sky-500/20 p-1 text-sky-400">
                    <SendIcon className="size-3.5" />
                  </div>
                  <span className="font-semibold text-foreground">Telegram Bot · wwatch-ops</span>
                </div>
                <span className="font-mono text-[11px]">14:02 UTC</span>
              </div>

              <div className="mt-3 font-mono text-[12px] space-y-1.5 leading-relaxed">
                <p className="font-bold text-destructive flex items-center gap-1.5">
                  <ShieldAlertIcon className="size-4" />
                  <span>[wwatch] store.example.com needs attention</span>
                </p>
                <p className="text-foreground/90 pl-5">
                  ● <strong className="text-foreground">Site unreachable:</strong> HTTP 502 Bad Gateway (upstream timeout)
                </p>
                <p className="text-foreground/90 pl-5">
                  ● <strong className="text-foreground">Exposed file:</strong> /wp-content/debug.log found publicly accessible
                </p>
                <p className="text-foreground/90 pl-5">
                  ● <strong className="text-foreground">TLS Window:</strong> Certificate expires in 11 days
                </p>
                <div className="pt-2 pl-5 text-[11px] text-muted-foreground border-t border-border/50 mt-2">
                  Scanned 2 min ago · Snapshot #142
                </div>
              </div>
            </div>

            {/* Email Notification Snippet */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-muted p-1 text-muted-foreground">
                    <MailIcon className="size-3.5" />
                  </div>
                  <span className="font-semibold text-foreground">Email Alert · alerts@your-domain.com</span>
                </div>
                <span className="font-mono text-[11px]">via Resend</span>
              </div>

              <div className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground">wwatch detected 1 critical regression on client-portal.io</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Credentials remain secure on your server. No sensitive tokens transmitted in notification bodies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
