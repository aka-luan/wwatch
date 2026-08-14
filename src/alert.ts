import type { Finding, Site } from "./domain.js";

export type AlertChannel =
  | { kind: "telegram"; token: string; chatId: string }
  | { kind: "email"; apiKey: string; to: string; from: string };

export type AlertConfig = {
  channels: AlertChannel[];
};

export function alertConfigFromEnv(env: NodeJS.Dict<string> = process.env): AlertConfig {
  const channels: AlertChannel[] = [];
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (token && chatId) {
    channels.push({ kind: "telegram", token, chatId });
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.ALERT_EMAIL?.trim();
  if (apiKey && to) {
    channels.push({
      kind: "email",
      apiKey,
      to,
      from: env.ALERT_FROM?.trim() || "wwatch <beth.t@example.com>",
    });
  }
  return { channels };
}

export function isAlertable(finding: Finding): boolean {
  if (finding.kind === "down" || finding.kind === "auth_failed") {
    return true;
  }
  return finding.kind === "exposed_path" && finding.severity === "crit";
}

export function findingIdentity(finding: Finding): string {
  if (finding.kind === "exposed_path") {
    return `${finding.kind}:${finding.path}`;
  }
  return finding.kind;
}

export function newCrits(previous: Finding[], current: Finding[]): Finding[] {
  const seen = new Set(previous.filter(isAlertable).map(findingIdentity));
  return current.filter(isAlertable).filter((finding) => !seen.has(findingIdentity(finding)));
}

export function alertSubject(site: Pick<Site, "name">, findings: Finding[]): string {
  const first = findings[0];
  if (!first) {
    return `wwatch: ${site.name}`;
  }
  if (findings.length === 1) {
    return `wwatch: ${site.name}. ${first.title}`;
  }
  return `wwatch: ${site.name}. ${findings.length} new crits`;
}

export function alertBody(site: Pick<Site, "name" | "origin">, findings: Finding[]): string {
  const blocks = [`${site.name} (${site.origin})`];
  for (const finding of findings) {
    blocks.push(finding.detail ? `${finding.title}\n${finding.detail}` : finding.title);
  }
  return blocks.join("\n\n");
}

export async function sendAlerts(input: {
  site: Pick<Site, "name" | "origin">;
  previous: Finding[];
  current: Finding[];
  config: AlertConfig;
  fetch: typeof fetch;
}): Promise<void> {
  const findings = newCrits(input.previous, input.current);
  if (findings.length === 0 || input.config.channels.length === 0) {
    return;
  }
  const text = alertBody(input.site, findings);
  const subject = alertSubject(input.site, findings);
  await Promise.all(
    input.config.channels.map((channel) => deliver(channel, { text, subject }, input.fetch)),
  );
}

async function deliver(
  channel: AlertChannel,
  message: { text: string; subject: string },
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    if (channel.kind === "telegram") {
      const response = await fetchImpl(`https://api.telegram.org/bot${channel.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: channel.chatId,
          text: message.text,
          disable_web_page_preview: true,
        }),
      });
      await response.arrayBuffer();
      return;
    }
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${channel.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: channel.from,
        to: [channel.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    await response.arrayBuffer();
  } catch {
    return;
  }
}
