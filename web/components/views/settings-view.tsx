import { useState } from "react";
import { DownloadIcon, SaveIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsView() {
  const [scanInterval, setScanInterval] = useState("5");
  const [telegramToken, setTelegramToken] = useState("••••••••••••••••••••••••");
  const [telegramChatId, setTelegramChatId] = useState("-1002348912401");
  const [resendApiKey, setResendApiKey] = useState("re_••••••••••••••••••••");
  const [alertEmail, setAlertEmail] = useState("ops@agency-example.com");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    toast.success("Settings saved successfully", {
      description: "Scan intervals and alert channels updated.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SettingsIcon className="size-5 text-muted-foreground" />
            <span>Fleet &amp; System Settings</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            Configure scan frequencies, notification tokens, and optional helper plugin
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 bg-[#f97316] text-white hover:bg-[#ea580c]"
        >
          <SaveIcon className="size-4" />
          <span>{saving ? "Saving…" : "Save Changes"}</span>
        </Button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Scan Automation Settings */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-bold text-sm text-foreground font-sans">Automated Scan Frequency</h3>
            <p className="text-muted-foreground mt-0.5">
              How often wwatch probes your fleet for reachability, plugins, and security
            </p>
          </div>

          <label>
            Background Scan Interval
            <select
              value={scanInterval}
              onChange={(e) => setScanInterval(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-raised p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="1">Every 1 minute (Aggressive)</option>
              <option value="5">Every 5 minutes (Recommended)</option>
              <option value="15">Every 15 minutes</option>
              <option value="60">Every 1 hour</option>
              <option value="360">Every 6 hours</option>
            </select>
          </label>

          <div className="rounded-lg border border-border/50 bg-raised/30 p-3 text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Zero Agent Overhead:</span> Probes are
            dispatched asynchronously without placing load on the target WordPress servers.
          </div>
        </div>

        {/* Optional Helper Plugin */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-bold text-sm text-foreground font-sans">WWatch Helper Plugin</h3>
            <p className="text-muted-foreground mt-0.5">
              Optional plugin for single-click WP Admin magic login links and in-dashboard repair
            </p>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Standard health &amp; uptime monitoring works without any plugins. Install `wwatch.php`
            on client sites if you want 1-click WP Admin login tokens and auto-remediation.
          </p>

          <a
            href="/api/helper-plugin"
            download="wwatch-helper.php"
            className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-raised px-4 py-2.5 font-semibold text-foreground hover:bg-raised/80 transition-colors"
          >
            <DownloadIcon className="size-4 text-emerald-400" />
            <span>Download Helper Plugin (.php)</span>
          </a>
        </div>

        {/* Telegram Bot Settings */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-bold text-sm text-foreground font-sans">Telegram Bot Credentials</h3>
            <p className="text-muted-foreground mt-0.5">
              Direct alerts dispatched to Telegram chats or ops channels
            </p>
          </div>

          <label>
            Telegram Bot Token
            <Input
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </label>

          <label>
            Telegram Chat ID
            <Input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </label>
        </div>

        {/* Resend Email Settings */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-bold text-sm text-foreground font-sans">Resend Email Delivery</h3>
            <p className="text-muted-foreground mt-0.5">
              Transactional email delivery for operational alerts
            </p>
          </div>

          <label>
            Resend API Key
            <Input
              type="password"
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </label>

          <label>
            Alert Recipient Email
            <Input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </label>
        </div>
      </form>
    </div>
  );
}
