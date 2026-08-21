import { GithubIcon } from "./icons";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background py-12 text-[13px] text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        {/* Brand & Mission */}
        <div>
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <span className="size-2 rounded-full bg-success" />
            <span>wwatch</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground/80 max-w-sm">
            Open-source WordPress fleet operations board. Monitored via core REST & Application Passwords.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <a
            href="https://github.com/aka-luan/wwatch"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <GithubIcon className="size-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href="https://github.com/aka-luan/wwatch#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Documentation
          </a>
          <a
            href="https://github.com/aka-luan/wwatch#deploy-on-vercel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Deploy Guide
          </a>
          <a href="/app" className="text-ring hover:underline">
            Launch Dashboard
          </a>
        </div>

        {/* Legal & Meta */}
        <div className="text-xs text-muted-foreground/70 font-mono">
          <span>MIT License · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
