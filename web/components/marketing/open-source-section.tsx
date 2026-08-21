import { useState } from "react";
import { CheckIcon, CopyIcon, LockIcon, ServerIcon, ShieldCheckIcon, TerminalIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GithubIcon } from "./icons";
import { cn } from "@/lib/utils";

export function OpenSourceSection() {
  const [copied, setCopied] = useState(false);
  const cloneCmd = "git clone https://github.com/aka-luan/wwatch.git\ncd wwatch\nnpm install\nnpm start";

  function copyCommands() {
    navigator.clipboard.writeText(cloneCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="open-source" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left: Copy & Value Proposition */}
          <div className="lg:col-span-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              SELF-HOSTED FREEDOM
            </span>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your sites. Your infrastructure.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              wwatch is 100% open-source software. You control the database, the credentials, and the network. No
              third-party cloud gets access to your WordPress administrator tokens.
            </p>

            <div className="mt-6 space-y-3 font-mono text-[12px] text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <ShieldCheckIcon className="size-4 text-success" />
                <span>Application Passwords encrypted at rest via AES-GCM (WATCH_SECRET)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ServerIcon className="size-4 text-success" />
                <span>Runs as a single Node.js process or serverless on Vercel + Turso</span>
              </div>
              <div className="flex items-center gap-2.5">
                <LockIcon className="size-4 text-success" />
                <span>Zero telemetry, zero external tracking, zero vendor lock-in</span>
              </div>
            </div>

            <div className="mt-8">
              <a
                href="https://github.com/aka-luan/wwatch"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2 border-border")}
              >
                <GithubIcon className="size-4" />
                <span>View source on GitHub →</span>
              </a>
            </div>
          </div>

          {/* Right: Interactive Terminal Quickstart Box */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden font-mono text-[13px]">
              {/* Terminal Titlebar */}
              <div className="flex items-center justify-between border-b border-border bg-raised px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="size-4 text-muted-foreground" />
                  <span className="text-[12px] font-medium text-foreground">Local Quickstart</span>
                </div>
                <button
                  type="button"
                  onClick={copyCommands}
                  className="flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Copy terminal commands"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3 text-success" />
                      <span className="text-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Terminal Body */}
              <div className="p-4 bg-background/90 text-foreground/90 space-y-1.5 overflow-x-auto leading-relaxed">
                <p className="text-muted-foreground"># 1. Clone repository</p>
                <p className="text-ring">$ git clone https://github.com/aka-luan/wwatch.git</p>
                <p className="text-ring">$ cd wwatch</p>
                <p className="text-muted-foreground pt-1"># 2. Install dependencies & run</p>
                <p className="text-ring">$ npm install</p>
                <p className="text-ring">$ npm start</p>
                <p className="text-muted-foreground pt-2 text-[12px]">
                  Listening on http://127.0.0.1:8787 (SQLite initialized at data/watch.db)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
