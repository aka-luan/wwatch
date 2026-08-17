# wwatch

A board for WordPress sites you already admin. You add a site with an Application Password. wwatch scans it and shows core updates, plugin and theme updates, broken links, exposed files, TLS windows, and a few Site Health tests. With helper 1.3.0 it also shows PHP, constants, checksums, must-use plugins, cron, autoload size, and admin-user facts that core REST cannot see.

Scans talk to core REST. Nothing is installed on WordPress for that. Auto-login, one-click plugin/theme/core updates, and Fix on a few exposed-file findings need the optional `plugin/wwatch.php` helper (`wwatch/v1`). A scan records whether that plugin is present and which capabilities it has. Update all plugins and themes from the site page. Core is a separate button. Fix only appears when the helper advertises `repair` (v1.2.0). Health findings appear when `GET /wp-json/wwatch/v1/health` answers (v1.3.0). A scan detects the plugin at `GET /wp-json/wwatch/v1/status` (v1.3.1) and falls back to the namespace root for older copies. An older helper that 404s that route still scans; you just do not get those extra findings.

## Run locally

```bash
npm install
npm start
```

Open http://127.0.0.1:8787

`npm start` builds the dashboard into `public/` then serves it. During UI work, `npm run dev` rebuilds the frontend on change and restarts the server.

Data lives in `data/watch.db`. Override the path with `WATCH_DB`.

To require a password for the board itself:

```bash
DASHBOARD_PASSWORD=your-password npm start
```

## Deploy on Vercel

A Vercel function has no durable disk and no shared memory. wwatch stores sites, scans, and in-flight jobs in [Turso](https://turso.tech) (hosted SQLite). A board password is required. The function is allowed 60 seconds per scan, which needs a Vercel Pro plan. Hobby caps out at 10 seconds and will cut large scans short.

1. Create a Turso database and copy the URL plus auth token.
2. Push this repo to GitHub and import it in Vercel.
3. Set these environment variables on the Vercel project:

   - `DASHBOARD_PASSWORD` — the password you type on `/login.html`. Sessions last 7 days.
   - `WATCH_SECRET` — optional. Encrypts Application Passwords in Turso. If unset, `DASHBOARD_PASSWORD` is the wrapping key. Set this if you want to change the board password later without rewriting site credentials.
   - `TURSO_DATABASE_URL` — `libsql://...`
   - `TURSO_AUTH_TOKEN`
   - `CRON_SECRET` — Vercel sends this as `Authorization: Bearer …` on the daily scan. Without it the board password blocks the cron.

4. Deploy. Open the Vercel URL, sign in, add a site.

```bash
npx vercel
```

Application Passwords for your WordPress sites live in Turso, encrypted at rest when `WATCH_SECRET` or `DASHBOARD_PASSWORD` is set. Treat that database like production secrets.

The board cookie is an HMAC of the dashboard password with a 7-day lifetime. **Log out** clears it.

## Connect a site

1. In wp-admin, open **Users → Profile**.
2. Create an Application Password.
3. On the board, click **Add site**.
4. Paste the site URL, your WordPress **login** (not the Application Password name), and the password you just copied.

Use an administrator account. Application Passwords inherit that user's capabilities. WordPress usually requires HTTPS for them.

If connect says WordPress did not see the password, the host or CDN dropped the `Authorization` header. Hostinger CDN does this. In hPanel, disable CDN or exclude `/wp-json`, or add `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` to `.htaccess`.

wwatch starts a scan as soon as the site is added. To rename a site or rotate the Application Password, open the site page and use its **Settings** tab. The origin cannot change; scan history stays.

### Log in, update, and fix from the board

Application Passwords cannot create a wp-admin cookie, and core REST cannot upgrade a plugin, theme, or WordPress itself. The helper plugin does those jobs, and it can delete a short allowlist of public files:

1. Download `wwatch.zip` from the site page — the board packages `plugin/wwatch.php` the way the WordPress uploader wants it. Replace an older copy if one is already installed. Current helper is 1.3.1.
2. In wp-admin, open **Plugins → Add New → Upload Plugin** and activate it.
3. Scan the site. The site page then shows **WP Admin** in its header, **Update** on each plugin/theme/core finding, **Update all** on the **Updates** tab (plugins and themes; core stays its own button), and **Fix** on findings the helper can actually repair.

WP Admin mints a one-time link (30 seconds, single use) for the Application Password user. That user must be an administrator. Updates call `POST /wp-json/wwatch/v1/update` as that same user, then the board scans again. Fix calls `POST /wp-json/wwatch/v1/repair` the same way. If the plugin is missing or old, the board says so instead of opening a dead tab or pretending core REST can upgrade. A 1.1.0 helper still updates and hides Fix.

Fix is allowlisted. It can delete public `debug.log` files, `readme.html`, `license.txt`, and the backup wp-config names the scan already probes (`wp-config.php.bak`, `.save`, `.old`). It never deletes `wp-config.php`. XML-RPC is disabled through WordPress (`xmlrpc_enabled` → false) and left on disk. `.git` stays a human job.

Sites with `DISALLOW_FILE_MODS` cannot update from the board. The helper will say so.

## What a scan checks

- Homepage reachability and the WordPress generator version
- `/wp-json` and authenticated `/wp/v2/plugins`
- Plugin, theme, and core versions against wordpress.org
- Site Health routes that core actually exports, including `wordpress-version` when the homepage hides the generator tag
- Same-origin links on the homepage (depth 1)
- A short list of exposed paths (`debug.log`, backup `wp-config` names, `.git/HEAD`, `readme.html`)
- Whether `xmlrpc.php` accepts a method call
- TLS days left, on HTTPS origins
- With helper 1.3.0, `GET /wp-json/wwatch/v1/health` (read-only, `manage_options`). A 404 is an old helper and is ignored.

The extra helper findings are facts core REST cannot see:

- PHP below what the installed core requires, or `memory_limit` under 64M
- `WP_DEBUG` on an https origin
- `DISALLOW_FILE_EDIT` off (the wp-admin file editor is available)
- `DISALLOW_FILE_MODS` or `AUTOMATIC_UPDATER_DISABLED`, which is why Update from the board can fail
- Core file checksums vs `api.wordpress.org/core/checksums` (matched / mismatched / skipped counts, not a file dump)
- Must-use plugins and drop-ins
- Missed cron events, and `DISABLE_WP_CRON`
- Autoloaded options above about 1 MB
- Administrator count, a user named `admin`, and whether user ID 1 is still there

These can warn or crit the rollup like any other finding. They do not send Telegram or email.

A scan is a snapshot. The fleet row shows the latest finished snapshot. The site page's **Activity** tab lists earlier scans (status, time, finding counts). A running scan does not rewrite that row until it finishes.

## Daily scan

Vercel hits `GET /api/scan-all` every day at 06:00 UTC. That is the same route as **Scan all**. Hobby only allows a daily cron, which is the interval this board needs. Without the cron, the board stays on the last scan you started by hand.

## Alerts

A new down, auth failure, or public `wp-config` backup, `debug.log`, or `.git` sends a message. The same finding the next day does not. Set one or both:

- Telegram: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Email: `RESEND_API_KEY` and `ALERT_EMAIL`. Optional `ALERT_FROM`. The default sender is Resend's `beth.t@example.com`, which only delivers to the address on that Resend account.

Core REST still cannot upgrade a plugin. Activate and deactivate stay on `/wp/v2/plugins`. Updates and Fix go through the helper.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run verify
```

## The board

Two screens.

**Fleet.** Four numbers across the top — Critical, Warning, Healthy, Pending updates — and the first three double as the status filter. Below them the fleet is one table: site, status, findings, updates, TLS, core, last scan. Narrow viewports drop Core and Last scan first, and below 840px the table becomes a stacked card list with status, the leading finding, and what is pending. Tick the checkbox on any site that has updates to select it; a sticky bar then names the selection, warns about sites that cannot update, and offers **Update selected** (confirmed by a dialog that lists every item it will run and every site it will skip) or **Scan selected**.

**Site.** Clicking a row opens the site's own page: a header with status, last scan, helper version and capabilities, and **Open site** / **WP Admin** / **Scan now**; then five tabs — **Findings** (needs-action first, informational collapsed), **Updates** (pending plugin/theme/core items plus **Update all**), **Plugins**, **Activity** (scan history), **Settings** (rename, rotate the Application Password, remove the site).

The board polls `/api/sites` every 2.5s, so scans started anywhere show up without a reload.

## UI components

The board is a Vite + React app in `web/`. shadcn/ui primitives (Base UI) live in `web/components/ui`. The app is dark-only — `<html class="dark">` is hardcoded in both entries. Product pieces on top of the primitives:

- `FleetStatStrip` — the four counters, three of which are the primary status filter
- `FleetTable` / `FleetCards` — the same rows and ordering at wide and narrow viewports (`web/lib/fleet-table.ts`)
- `FleetSelectionBar` + `BulkUpdateDialog` — multi-site selection and the confirm step that names every item and every skip (`web/lib/update-plan.ts`)
- `SitePage` — the tabbed site page, with `ScanTimeline` behind the Activity tab
- `FindingRow` — compact operator finding lines (actionable, updates, info, healthy checks)
- `StatusBadge` / `StatusDot` — site and finding status (`critical`, `attention`, `healthy`, `unknown`)
- Semantic tokens in `web/styles.css` (`background`, `foreground`, `muted`, `border`, `destructive`, `warning`, `success`) and the tone helpers in `web/lib/tone.ts` for the status rails

Use `Button` variants for hierarchy (`default` primary, `outline`, `ghost`, `destructive`). Confirm risky plugin, bulk-update, or remove-site actions with `AlertDialog`. Color is an accent — a dot, a left rail, a border — never a filled surface. `Toaster` (Sonner) is for short-lived feedback only. `Skeleton` is for first load, not for hiding a known scan while it refreshes.

View logic lives in `web/lib/*.ts` with its own `*.test.ts` next to it; components stay rendering-only. `npm test` runs those alongside the server tests in `src/`.

