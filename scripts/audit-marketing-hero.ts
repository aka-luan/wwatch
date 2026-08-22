import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { serve } from "@hono/node-server";
import { createLocalApp } from "../src/server.js";
import { Fleet } from "../src/fleet.js";
import { Store, storeConfigFromEnv } from "../src/store.js";
import { defaultDeps } from "../src/scan.js";
import { alertConfigFromEnv } from "../src/alert.js";

async function audit() {
  const artifactDir = "C:\\Users\\Akalu\\.gemini\\antigravity-acp\\brain\\bc94f775-08e9-4eba-8260-916942eaae02";
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log("Starting local test server on port 8799...");
  const fleet = new Fleet(new Store(storeConfigFromEnv()), defaultDeps, alertConfigFromEnv());
  const app = createLocalApp(fleet, "", "");
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 8799 });

  console.log("Launching Playwright...");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  console.log("Navigating to http://127.0.0.1:8799/ ...");
  await page.goto("http://127.0.0.1:8799/", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);

  const heroSection = page.locator("section").first();

  const desktopHeroPath = path.join(artifactDir, "hero_desktop.png");
  await page.screenshot({ path: desktopHeroPath, fullPage: false });
  console.log(`Saved desktop hero screenshot to: ${desktopHeroPath}`);

  // Element details & computed styles audit
  const auditReport: Record<string, any> = {};

  const announcementText = await page.locator("header a").first().textContent();
  auditReport.announcement = announcementText?.trim();

  const logoText = await page.locator("header a:has-text('WWatch')").textContent();
  const navLinks = await page.locator("header nav a").allTextContents();
  const ctaBtnText = await page.locator("header a:has-text('START MONITORING')").textContent();
  auditReport.nav = { logoText: logoText?.trim(), navLinks, ctaBtnText: ctaBtnText?.trim() };

  const headlineH1 = heroSection.locator("h1");
  const headlineSpans = await headlineH1.locator("span").allTextContents();
  auditReport.headline = headlineSpans.map((s) => s.trim()).filter(Boolean);

  const subhead = await heroSection.locator("p").first().textContent();
  const startBtn = await heroSection.locator("a:has-text('Start monitoring')").textContent();
  const demoBtn = await heroSection.locator("a:has-text('Book a demo')").textContent();
  auditReport.heroCta = { subhead: subhead?.trim(), startBtn: startBtn?.trim(), demoBtn: demoBtn?.trim() };

  const pillars = await heroSection.locator("div.grid-cols-3 > div").allTextContents();
  auditReport.pillars = pillars.map((p) => p.replace(/\s+/g, " ").trim());

  const signalCards = await heroSection.locator("div.space-y-2").first().locator("> div").allTextContents();
  auditReport.signals = signalCards.map((s) => s.replace(/\s+/g, " ").trim());

  const jsonBlock = await heroSection.locator("div.font-mono").first().textContent();
  auditReport.jsonSnippet = jsonBlock?.replace(/\s+/g, " ").substring(0, 150);

  const activityItems = await heroSection.locator("div.space-y-2.pt-0\\.5 > div").allTextContents();
  auditReport.activityItems = activityItems.map((a) => a.replace(/\s+/g, " ").trim());

  const canvasCount = await page.locator("canvas").count();
  auditReport.hasThreeJsCanvas = canvasCount > 0;

  console.log("AUDIT_REPORT_JSON_START");
  console.log(JSON.stringify(auditReport, null, 2));
  console.log("AUDIT_REPORT_JSON_END");

  // Mobile Viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileHeroPath = path.join(artifactDir, "hero_mobile.png");
  await page.screenshot({ path: mobileHeroPath, fullPage: false });
  console.log(`Saved mobile hero screenshot to: ${mobileHeroPath}`);

  await browser.close();
  server.close();
  console.log("Audit completed successfully!");
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
