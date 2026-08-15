# wwatch

A board for WordPress sites you already admin. You add a site with an Application Password. wwatch scans it and shows core updates, plugin and theme updates, broken links, exposed files, TLS windows, and a few Site Health tests.

Scans talk to core REST. Nothing is installed on WordPress for that. Auto-login from the board needs the optional `plugin/wwatch.php` helper, which also leaves a REST namespace (`wwatch/v1`) for later board actions core REST cannot do.

## Run locally

```bash
npm install
npm start
```

Open http://127.0.0.1:8787

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

wwatch starts a scan as soon as the site is added. To rename a site or rotate the Application Password, open the drawer and click **Edit**. The origin cannot change; scan history stays.

### Log in to wp-admin

Application Passwords cannot create a wp-admin cookie. To open the selected site already logged in:

1. Download `wwatch.php` from the site drawer (or copy `plugin/wwatch.php` from this repo).
2. In wp-admin, open **Plugins → Add New → Upload Plugin** and activate it.
3. On the board, open the site and click **Log in**.

The plugin mints a one-time link (30 seconds, single use) for the Application Password user. That user must be an administrator. If the plugin is missing, the board says so instead of opening a dead tab.

## What a scan checks

- Homepage reachability and the WordPress generator version
- `/wp-json` and authenticated `/wp/v2/plugins`
- Plugin, theme, and core versions against wordpress.org
- Site Health routes that core actually exports, including `wordpress-version` when the homepage hides the generator tag
- Same-origin links on the homepage (depth 1)
- A short list of exposed paths (`debug.log`, backup `wp-config` names, `.git/HEAD`, `readme.html`)
- Whether `xmlrpc.php` accepts a method call
- TLS days left, on HTTPS origins

A scan is a snapshot. The site row shows the latest finished snapshot. The drawer lists earlier scans (rollup, time, finding counts). A running scan does not rewrite that row until it finishes.

Vercel hits `GET /api/scan-all` every day at 06:00 UTC. That is the same route as **Scan all**. Hobby only allows a daily cron, which is the interval this board needs. Without the cron, the board stays on the last scan you started by hand.

A new down, auth failure, or public `wp-config` backup, `debug.log`, or `.git` sends a message. The same finding the next day does not. Set one or both:

- Telegram: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Email: `RESEND_API_KEY` and `ALERT_EMAIL`. Optional `ALERT_FROM`. The default sender is Resend's `beth.t@example.com`, which only delivers to the address on that Resend account.

Core REST cannot upgrade a plugin to a new version. The board can activate or deactivate a plugin. It will not pretend it can one-click update.

## Checks

```bash
npm test
npm run typecheck
npm run verify
```
