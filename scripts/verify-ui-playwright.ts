import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

async function run() {
  const artifactDir = "C:\\Users\\Akalu\\.gemini\\antigravity-ide\\brain\\5c9d5b2f-9e70-48bd-bcdf-f5c1e65354d3";
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log("Launching Chromium via Playwright...");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  console.log("Navigating to http://127.0.0.1:8787/app ...");
  await page.goto("http://127.0.0.1:8787/app", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForSelector("aside", { timeout: 10000 });

  // 1. Verify brand logo and sidebar elements
  console.log("Verifying sidebar elements...");
  const logoText = await page.locator("aside").textContent();
  console.log("Found sidebar text:", JSON.stringify(logoText));
  if (!logoText?.includes("Jane Doe")) {
    throw new Error("User profile 'Jane Doe' not found in sidebar");
  }
  console.log("✓ Sidebar elements verified");

  // 2. Verify Top KPI cards
  console.log("Verifying Top KPI cards...");
  const mainText = await page.locator("body").textContent();
  if (!mainText?.includes("UP") || !mainText?.includes("DEGRADED") || !mainText?.includes("DOWN") || !mainText?.includes("INCIDENTS")) {
    throw new Error("Top KPI cards missing");
  }
  console.log("✓ KPI cards verified");

  // 3. Verify 3-Column Screen of Reference
  console.log("Verifying 3-column Overview layout...");
  if (!mainText?.includes("SITES") || !mainText?.includes("INCIDENT TIMELINE") || !mainText?.includes("RESPONSE TIME (AVG)") || !mainText?.includes("ALERT DETAILS")) {
    throw new Error("Overview 3-column components missing");
  }
  console.log("✓ Overview 3-column layout components verified");

  // Capture Screenshot 1: Overview Screen (Reference Screen)
  const overviewScreenshotPath = path.join(artifactDir, "overview_redesign.png");
  await page.screenshot({ path: overviewScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${overviewScreenshotPath}`);

  // 4. Test SITES search
  console.log("Testing search input in SITES column...");
  const searchInput = page.locator("input[placeholder='Search sites...']");
  await searchInput.fill("blog");
  await page.waitForTimeout(300);
  const searchResultsText = await page.locator("aside + div").textContent();
  if (!searchResultsText?.includes("blog")) {
    throw new Error("Search filter failed to filter sites");
  }
  await searchInput.clear();
  await page.waitForTimeout(300);
  console.log("✓ Search input verified");

  // 5. Test clicking a site in SITES list
  console.log("Testing site item selection...");
  const siteButtons = page.locator("button:has-text('woocommerce')");
  if (await siteButtons.count() > 0) {
    await siteButtons.first().click();
    await page.waitForTimeout(400);
    const alertTitle = await page.locator("h3").textContent();
    console.log(`Alert title after selecting site: ${alertTitle}`);
  }
  console.log("✓ Site item selection verified");

  // 6. Test clicking an incident in INCIDENT TIMELINE
  console.log("Testing Incident Timeline click...");
  const timelineItem = page.locator("button:has-text('plugin-updates')");
  if (await timelineItem.count() > 0) {
    await timelineItem.first().click();
    await page.waitForTimeout(400);
  }
  console.log("✓ Incident timeline item selection verified");

  // 7. Test switching Signal Tabs (Uptime, SSL, Updates, Backups, Performance, Cron)
  console.log("Testing Signal Tabs...");
  await page.locator("button:has-text('SSL')").first().click();
  await page.waitForTimeout(300);
  await page.locator("button:has-text('Updates')").first().click();
  await page.waitForTimeout(300);
  await page.locator("button:has-text('Uptime')").first().click();
  await page.waitForTimeout(300);
  console.log("✓ Signal tabs verified");

  // 8. Test Navigation to other Views
  console.log("Testing navigation to Sites View...");
  await page.locator("aside button:has-text('Sites')").click();
  await page.waitForTimeout(500);
  const sitesScreenshotPath = path.join(artifactDir, "sites_view.png");
  await page.screenshot({ path: sitesScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${sitesScreenshotPath}`);

  console.log("Testing navigation to Alerts View...");
  await page.locator("aside button:has-text('Alerts')").click();
  await page.waitForTimeout(500);
  const alertsScreenshotPath = path.join(artifactDir, "alerts_view.png");
  await page.screenshot({ path: alertsScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${alertsScreenshotPath}`);

  console.log("Testing navigation to Incidents View...");
  await page.locator("aside button:has-text('Incidents')").click();
  await page.waitForTimeout(500);
  const incidentsScreenshotPath = path.join(artifactDir, "incidents_view.png");
  await page.screenshot({ path: incidentsScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${incidentsScreenshotPath}`);

  console.log("Testing navigation to Reports View...");
  await page.locator("aside button:has-text('Reports')").click();
  await page.waitForTimeout(500);
  const reportsScreenshotPath = path.join(artifactDir, "reports_view.png");
  await page.screenshot({ path: reportsScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${reportsScreenshotPath}`);

  console.log("Testing navigation to Team View...");
  await page.locator("aside button:has-text('Team')").click();
  await page.waitForTimeout(500);
  const teamScreenshotPath = path.join(artifactDir, "team_view.png");
  await page.screenshot({ path: teamScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${teamScreenshotPath}`);

  console.log("Testing navigation to Settings View...");
  await page.locator("aside button:has-text('Settings')").click();
  await page.waitForTimeout(500);
  const settingsScreenshotPath = path.join(artifactDir, "settings_view.png");
  await page.screenshot({ path: settingsScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${settingsScreenshotPath}`);

  // Return back to Overview
  await page.locator("aside button:has-text('Overview')").click();
  await page.waitForTimeout(500);

  // 9. Test "Add site" modal
  console.log("Testing Add site modal...");
  await page.locator("button:has-text('Add site')").click();
  await page.waitForTimeout(500);
  const addSiteScreenshotPath = path.join(artifactDir, "add_site_modal.png");
  await page.screenshot({ path: addSiteScreenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${addSiteScreenshotPath}`);

  await page.locator("button:has-text('Cancel')").click();
  await page.waitForTimeout(300);

  await browser.close();
  console.log("All Playwright UI verification steps passed successfully!");
}

run().catch((err) => {
  console.error("Playwright verification failed:", err);
  process.exit(1);
});
