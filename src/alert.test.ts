import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alertBody,
  alertConfigFromEnv,
  alertSubject,
  isAlertable,
  newCrits,
  sendAlerts,
} from "./alert.js";
import { parseOrigin, parsePluginRef, type Finding } from "./domain.js";

const down: Finding = { kind: "down", severity: "crit", title: "Site did not respond", detail: "ECONNREFUSED" };
const auth: Finding = { kind: "auth_failed", severity: "crit", title: "Application Password was rejected", detail: "401" };
const bak: Finding = {
  kind: "exposed_path",
  severity: "crit",
  title: "Backup wp-config is public",
  detail: "https://bakery.example/wp-config.php.bak returned 200",
  path: "/wp-config.php.bak",
};
const save: Finding = {
  kind: "exposed_path",
  severity: "crit",
  title: "Backup wp-config is public",
  detail: "https://bakery.example/wp-config.php.save returned 200",
  path: "/wp-config.php.save",
};
const git: Finding = {
  kind: "exposed_path",
  severity: "crit",
  title: ".git is public",
  detail: "https://bakery.example/.git/HEAD returned 200",
  path: "/.git/HEAD",
};
const debugLog: Finding = {
  kind: "exposed_path",
  severity: "crit",
  title: "debug.log is public",
  detail: "https://bakery.example/debug.log returned 200",
  path: "/debug.log",
};
const readme: Finding = {
  kind: "exposed_path",
  severity: "info",
  title: "readme.html is public",
  detail: "https://bakery.example/readme.html returned 200",
  path: "/readme.html",
};
const plugin: Finding = {
  kind: "plugin_update",
  severity: "warn",
  title: "Akismet 1.0 → 1.2",
  detail: "behind",
  plugin: parsePluginRef("akismet/akismet.php"),
  installed: "1.0",
  latest: "1.2",
};

test("only down, auth failure, and crit exposed paths are alertable", () => {
  assert.equal(isAlertable(down), true);
  assert.equal(isAlertable(auth), true);
  assert.equal(isAlertable(bak), true);
  assert.equal(isAlertable(git), true);
  assert.equal(isAlertable(debugLog), true);
  assert.equal(isAlertable(readme), false);
  assert.equal(isAlertable(plugin), false);
});

test("newCrits alerts the first time, not while the same finding stays", () => {
  assert.deepEqual(newCrits([], [down, plugin]), [down]);
  assert.deepEqual(newCrits([down], [down, plugin]), []);
  assert.deepEqual(newCrits([down], [plugin]), []);
  assert.deepEqual(newCrits([plugin], [down]), [down]);
});

test("a new backup wp-config path is a new crit even if another backup was already public", () => {
  assert.deepEqual(newCrits([bak], [bak, save]), [save]);
  assert.deepEqual(newCrits([bak], [bak, git, debugLog]), [git, debugLog]);
});

test("alert copy names the site and stacks each new finding", () => {
  const site = { name: "Bakery", origin: parseOrigin("https://bakery.example") };
  assert.equal(alertSubject(site, [down]), "wwatch: Bakery. Site did not respond");
  assert.equal(alertSubject(site, [down, bak]), "wwatch: Bakery. 2 new crits");
  assert.equal(
    alertBody(site, [down, bak]),
    "Bakery (https://bakery.example)\n\nSite did not respond\nECONNREFUSED\n\nBackup wp-config is public\nhttps://bakery.example/wp-config.php.bak returned 200",
  );
});

test("alertConfigFromEnv turns on Telegram, email, or both", () => {
  assert.deepEqual(alertConfigFromEnv({}), { channels: [] });
  assert.deepEqual(
    alertConfigFromEnv({ TELEGRAM_BOT_TOKEN: "tok", TELEGRAM_CHAT_ID: "99" }).channels,
    [{ kind: "telegram", token: "tok", chatId: "99" }],
  );
  assert.deepEqual(
    alertConfigFromEnv({ RESEND_API_KEY: "re_1", ALERT_EMAIL: "you@example.com" }).channels,
    [{ kind: "email", apiKey: "re_1", to: "you@example.com", from: "wwatch <beth.t@example.com>" }],
  );
  assert.equal(
    alertConfigFromEnv({
      TELEGRAM_BOT_TOKEN: "tok",
      TELEGRAM_CHAT_ID: "99",
      RESEND_API_KEY: "re_1",
      ALERT_EMAIL: "you@example.com",
      ALERT_FROM: "Watch <watch@bakery.example>",
    }).channels.length,
    2,
  );
});

test("sendAlerts posts to Telegram and Resend, and ignores a dead channel", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  await sendAlerts({
    site: { name: "Bakery", origin: parseOrigin("https://bakery.example") },
    previous: [],
    current: [down],
    config: {
      channels: [
        { kind: "telegram", token: "tok", chatId: "99" },
        { kind: "email", apiKey: "re_1", to: "you@example.com", from: "wwatch <alerts@bakery.example>" },
      ],
    },
    fetch: async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      if (String(input).includes("telegram")) {
        throw new Error("telegram down");
      }
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.url ?? "", /api\.telegram\.org\/bottok\/sendMessage/);
  assert.match(calls[0]?.body ?? "", /Bakery/);
  assert.equal(calls[1]?.url, "https://api.resend.com/emails");
  assert.match(calls[1]?.body ?? "", /Site did not respond/);
});

test("sendAlerts does nothing when the crit is already known", async () => {
  let calls = 0;
  await sendAlerts({
    site: { name: "Bakery", origin: parseOrigin("https://bakery.example") },
    previous: [down],
    current: [down],
    config: { channels: [{ kind: "telegram", token: "tok", chatId: "99" }] },
    fetch: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(calls, 0);
});
