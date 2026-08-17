# OWASP review — wwatch board + helper plugin

Manual review against the OWASP Top 10 (2021), covering the Hono/TypeScript service in
`src/`, the React dashboard in `web/`, and the WordPress helper plugin in `plugin/wwatch.php`.
Findings 1 and 2 have been fixed in this branch; the rest are recorded here with locations and
suggested fixes.

Scope reviewed: `src/http.ts`, `src/index.ts`, `src/server.ts`, `src/store.ts`, `src/wrap.ts`,
`src/fleet.ts`, `src/scan.ts`, `src/helper.ts`, `src/domain.ts`, `src/alert.ts`, `src/zip.ts`,
`web/**`, `plugin/wwatch.php`.

## Summary

| # | Finding | OWASP | Severity | Status |
|---|---------|-------|----------|--------|
| 1 | Session cookie is an HMAC keyed by the dashboard password | A02, A07 | High | **Fixed** |
| 2 | Stored Application Passwords are wrapped with a key derived from that same password by one SHA-256 | A02 | High | **Fixed** |
| 3 | Helper plugin gates updates/repairs on `manage_options` (multisite privilege escalation) | A01 | Medium | Open |
| 4 | Scanner will fetch private/internal addresses (authenticated SSRF) | A10 | Medium | Open |
| 5 | Login rate limit keys on a client-controlled `X-Forwarded-For` | A07 | Medium | Open |
| 6 | Logout does not revoke the session server-side | A07 | Low | Open |
| 7 | State-changing endpoints rely on `SameSite=Lax` alone | A01 | Low | Open |
| 8 | Internal error text is returned to the client | A05 | Low | Open |
| 9 | Auto-login token travels in the URL query string | A07 | Low | Open |
| 10 | `login_failures` grows without pruning | A05 | Info | Open |
| 11 | Helper zip is served unsigned, with no integrity check | A08 | Info | Open |

Checked and found sound: SQL is fully parameterized (`src/store.ts`, and `$wpdb->prepare` with
placeholders in `wwatch_autoload_bytes`); no XSS sinks in the dashboard (no
`dangerouslySetInnerHTML`, no `innerHTML`, no `eval`); path handling for updates/repairs is
allow-listed on both ends (`parsePluginRef`, `parseThemeSlug`, `isRepairablePath`,
`wwatch_delete_under` with a `realpath` + parent-directory check); redirects are `manual`
everywhere and `readSameOrigin` refuses to follow off-origin; the login-link response is
validated to be on the site's own origin before it reaches the browser; security headers
(CSP, `frame-ancestors 'none'`, nosniff, `Referrer-Policy: no-referrer`, HSTS on Vercel) are
applied to every response; password comparison is constant-time over SHA-256 digests.

## Findings

### 1. Session cookie is an HMAC keyed by the dashboard password — A02/A07, High — FIXED

`src/http.ts`: `sessionToken()` is `issuedAt + "." + HMAC-SHA256(password, purpose:issuedAt)`.
The cookie therefore contains a plaintext-known message and its MAC under a key that *is* the
dashboard password. Anyone who obtains one cookie (shared machine, proxy log, browser
extension, XSS elsewhere on the origin) can run an offline dictionary attack against the
password at full GPU speed, with no rate limit involved. Because that password is also the
default key material for finding 2, cracking it yields every stored WordPress Application
Password.

Fixed: `sessionKeyFromEnv()` derives the MAC key from `WATCH_SECRET`, never from the board
password, and falls back to 32 random bytes per process when it is unset (dev only — sessions
end on restart). The cookie is now `issuedAt.nonce.MAC` with a 16-byte random nonce, so two
logins in the same millisecond produce different cookies and the cookie is no longer a
password-derived value. `createApp()` takes the key as an argument, so deployments and tests
supply it explicitly.

### 2. Credential wrapping key derives from the login password via one SHA-256 — A02, High — FIXED

`src/wrap.ts`: `wrapSecretFromEnv()` falls back to `DASHBOARD_PASSWORD`, and `keyFromSecret()`
is a single unsalted SHA-256. AES-256-GCM itself is used correctly (random 12-byte IV, auth
tag stored and verified), but the key is only as strong as a human-chosen password run through
one fast hash. The plaintext being protected is an administrator Application Password for every
monitored WordPress site.

Fixed: `deployConfigError()` now refuses to serve without `WATCH_SECRET`, and `src/wrap.ts`
writes a `v2:` format — per-row 16-byte salt, scrypt (N=16384, r=8, p=1) to a 32-byte key, then
AES-256-GCM. Derived keys are memoised (capped at 64) so the 2.5-second dashboard poll does not
pay a scrypt per site per request. `v1:` rows are still readable, and `Store` reseals anything
that is not current-format-under-the-current-secret on startup, so setting `WATCH_SECRET` on an
existing board migrates its rows instead of locking them out.

### 3. Helper plugin authorizes updates and repairs with `manage_options` — A01, Medium

`plugin/wwatch.php`: every route uses `wwatch_can_manage()` (`current_user_can("manage_options")`).
On single-site that is roughly equivalent to administrator, but on multisite a site
administrator holds `manage_options` while `update_plugins`, `update_themes`, `update_core`,
and file deletion are reserved for the network super-admin. A site admin on a multisite install
can therefore use `/wp-json/wwatch/v1/update` to upgrade network-wide plugins, themes, and core,
and `/repair` to delete files under `ABSPATH` — capabilities WordPress deliberately withholds
from them.

Fix: gate each route on the capability it actually exercises — `update_plugins` /
`update_themes` / `update_core` for the update kinds, `delete_files` (or `is_super_admin()` on
multisite) for repair — rather than a blanket `manage_options`.

### 4. Scanner reaches private and internal addresses — A10, Medium

`parseOrigin()` in `src/domain.ts` blocks link-local (`169.254/16`, `fe80::`), `0.0.0.0/8`, and
cloud metadata hostnames, and permits plain HTTP only for loopback. It does not block RFC1918
space, CGNAT, or `127.0.0.0/8` addresses other than `127.0.0.1` — `https://10.0.0.5` and
`https://192.168.1.1` are accepted origins. The scan then issues GET/POST to a dozen paths on
that host and surfaces response status, body-derived detail strings, and network error text
back into findings (`broken_link`, `exposed_path`, `down`), which is enough to enumerate an
internal network. Validation is also name-based, so a hostname that resolves to an internal
address (or re-resolves between check and fetch) passes.

This requires a logged-in board user, so it is not remotely exploitable on its own; it matters
because the board is a single shared password away from an internal-network probe.

Fix: extend `isBlockedOriginHost()` to the full private/reserved set, and resolve the hostname
and check the resulting addresses before each outbound request (or route scans through a proxy
that enforces this).

### 5. Login rate limit keys on a spoofable header — A07, Medium

`clientIp()` in `src/http.ts` takes the first comma-separated token of `X-Forwarded-For`, which
the client supplies. Behind Vercel the platform overwrites that header, but for any deployment
run directly (`npm start`) or behind a proxy that appends rather than replaces, an attacker
rotates the header per request and the 10-per-15-minute limit in `src/store.ts` never engages —
unlimited guesses against the single dashboard password.

Fix: read the client address from the socket by default, and only trust `X-Forwarded-For` when
an explicit trusted-proxy setting is configured (and then take the last untrusted hop, not the
first token).

### 6. Logout does not revoke the session — A07, Low

`POST /api/logout` clears the cookie in the browser only. Any copy of the cookie stays valid
for the full 7-day `SESSION_TTL_MS`; there is no server-side session record to delete. Since
finding 1, rotating `WATCH_SECRET` invalidates every outstanding cookie at once — that is the
only revocation there is, and it forces a rewrap of stored credentials on the next start.

Fix: persist the cookie's nonce as a session record (it is already random per login) and delete
it on logout, or keep a `not-before` timestamp that logout advances.

### 7. No CSRF token on state-changing routes — A01, Low

All mutating routes are POST/PATCH/DELETE with a `SameSite=Lax` session cookie, which blocks
cross-site submission in current browsers. There is no second layer: no CSRF token and no
`Origin`/`Sec-Fetch-Site` check, and `readJsonObject()` parses the body regardless of
`Content-Type`, so a simple-request form post would be accepted if the cookie ever rode along.

Fix: reject requests whose `Origin` is not same-origin (or require
`Sec-Fetch-Site: same-origin`) on mutating routes; it is a few lines in the existing middleware.

### 8. Internal error text reaches the client — A05, Low

Handlers in `src/http.ts` return `message(error)` verbatim, so client responses can carry
messages such as `Could not decrypt site credentials. Check WATCH_SECRET.` or raw fetch/DNS
failures. Minor, since these routes are authenticated, but it exposes deployment detail to
anyone who gets a session.

Fix: map known errors to fixed user-facing strings and log the detail server-side.

### 9. Auto-login token travels in the query string — A07, Low

`wwatch_mint_login_link()` returns `?wwatch_login=<64 hex>` and `wwatch_consume_login()` reads
it from `$_GET`. The token is high-entropy, single-use, 30-second TTL, stored only as a
SHA-256-keyed transient, and `nocache_headers()` is set — good design — but the value still
lands in web-server access logs, browser history, and any `Referer` sent from the landing
request.

Fix: acceptable as-is given the TTL; if tightened, redirect to a tokenless URL immediately and
prefer a POST-based hand-off.

### 10. `login_failures` is never pruned — A05, Info

`src/store.ts` inserts a row per source IP and only deletes on successful login. Expired windows
accumulate, so the spoofable-header case in finding 5 doubles as unbounded table growth.

Fix: delete rows where `reset_at < now` during `loginAllowed()`/`recordLoginFailure()`.

### 11. Helper zip is unsigned — A08, Info

`/api/helper-plugin` builds the zip in-process from `plugin/wwatch.php` (`src/zip.ts`, stored
entries, fixed internal path) and the download itself sits behind dashboard auth over HTTPS, so
there is no live tampering path. There is no published checksum or signature for the operator
to verify before uploading it into WordPress.

Fix: publish a SHA-256 of the zip next to the download link.
