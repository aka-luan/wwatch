
const STEPS = [
  {
    step: "01",
    title: "Connect via Application Password",
    description:
      "Open your WordPress Profile in wp-admin, generate a standard Application Password, and paste the credentials into wwatch. No plugins required.",
    meta: "Users → Profile → Application Passwords",
  },
  {
    step: "02",
    title: "Automated Non-Destructive Scans",
    description:
      "wwatch probes the site via authenticated REST API and public HTTP checks. Every run records an immutable snapshot with finding deltas.",
    meta: "Parallel HTTP probes & TLS handshake",
  },
  {
    step: "03",
    title: "Monitor, Alert & Remediate",
    description:
      "Watch the fleet rollup, receive Telegram/email alerts for newly detected issues, inspect history, or execute updates and 30s wp-admin logins.",
    meta: "Snapshot comparisons & Action Center",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-raised/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            SETUP & WORKFLOW
          </span>
          <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Up and running in two minutes
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            No complex infrastructure, no monitoring daemon to compile, and no code injected into your WordPress theme.
          </p>
        </div>

        {/* 3-Step Connected Flow Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-3 relative">
          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className="relative flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xl transition-colors hover:border-border-strong"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="font-mono text-2xl font-bold text-ring">{step.step}</span>
                  <span className="rounded bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    STAGE {step.step}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-foreground text-[16px] leading-snug">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
              </div>

              <div className="mt-6 border-t border-border/60 pt-3">
                <span className="font-mono text-[11px] text-muted-foreground/80">{step.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
