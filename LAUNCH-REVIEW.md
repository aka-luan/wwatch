# wwatch open-core launch review

Reviewed 2026-10-27 against `main` @ `28d2bfa`. Benchmark: Inngest (open-source server + paid Inngest Cloud).
Every claim cites a file in this repo, a command I ran, or a URL fetched today. Things I could not verify are listed in §10.

---

## 0. Bottom line

The scan engine, the WordPress helper plugin, and the board are real and well tested at the logic level (191/191 tests, `npm run verify` green). It is a **working single-operator tool**. It is not yet a releasable open-source project, and it has none of the hosted-platform layer.

- **OSS blockers.**
  - There is no license, so nobody may legally use it.
  - The README's default run stores WordPress admin credentials in plaintext.
  - Self-hosted installs never scan on a schedule.
  - The README's URL opens a pricing page instead of the board.
- **Hosted blocker.** There is no concept of a user or tenant anywhere in the schema. The marketing page sells $19 and $79 plans and features that do not exist.

---

## 1. Fresh clone, README-only install

Environment: Linux, Node v22.22.0, npm 10.9.4. Clone into an empty scratch dir from `https://github.com/aka-luan/wwatch`.

| Step (README) | Result | Time |
|---|---|---|
| `git clone` | ok | 1 s |
| `npm install` | ok, but prints **"17 vulnerabilities (4 moderate, 10 high, 3 critical)"** | 11 s |
| `npm start` (runs `vite build` then `tsx src/server.ts`) | ok, plus a chunk-size warning (`main-*.js` is 589 kB) | ~3 s to first 200 |
| "Open http://127.0.0.1:8787" | **Unclear.** `/` serves the marketing landing page ("Unmissable WordPress Monitoring", with $19/$79 pricing), not the board. The board is at `/app` (`src/server.ts:13-14`). The README never mentions `/app`. | — |
| `DASHBOARD_PASSWORD=… npm start`, then log in | ok. Unauthenticated `/api/sites` returns 401 and `/app` redirects to `/login.html`. | — |
| Add a site | Needs a real WordPress site with HTTPS and an Application Password. There is no demo or seed mode. A non-WP origin gets a clear error ("This origin does not look like WordPress REST"). | — |
| "Daily scan" section | **Vercel-only.** In Node mode nothing schedules a scan: there is no timer in `src/` and the only cron is `vercel.json`. The README does not say this. | — |
| `npm test` | 191 pass, 0 fail | 3 s |
| `npm run typecheck` | **FAIL**, exit 2 (see §2) | 2 s |
| `npm run lint` | **FAIL**, exit 1 (see §2) | 4 s |
| `npm run verify` | `verify ok` | 2 s |

Total from clone to a running board: about 15 s of machine time. The friction is in what the docs leave out:

1. **No Node version stated.** There is no `engines` field in `package.json`. I only verified Node 22.22.
2. **Wrong landing URL.** `/` is marketing, so a self-hoster's first screen is a pricing page for a product they are self-hosting.
3. **Insecure defaults, not flagged.** With neither `WATCH_SECRET` nor `DASHBOARD_PASSWORD` set (the README's first command), Application Passwords for **administrator** accounts are stored **in plaintext**. `Store.#seal` returns `plain` when there is no secret (`src/store.ts:309-310`).
   - With only `DASHBOARD_PASSWORD` set (the README's second command), the board password becomes the encryption key (`src/wrap.ts`, `wrapSecretsFromEnv`). That is the coupling `SECURITY-REVIEW.md` finding #2 says is fixed, but it is only fixed for the Vercel entry point (`src/index.ts:8-22`).
   - `src/server.ts` validates nothing.
4. **Exposure is undocumented.** Binding to anything other than localhost (`HOST=0.0.0.0`) is documented only in `AGENTS.md`, not the README, and nothing warns when the board is exposed without a password.
5. **The secret is buried.** `WATCH_SECRET` is only explained inside "Deploy on Vercel", so self-hosters will skip it.
6. **No scheduled scans off Vercel.** A self-hoster has to work out that they can cron `GET /api/scan-all` with `Authorization: Bearer $CRON_SECRET` (`src/http.ts:146-149,248-257`). This is undocumented for self-hosting.
7. **Self-hosting is a footnote.** There is no Docker image, compose file, systemd unit, or reverse-proxy/TLS guide. `TRUST_PROXY` is the only hint that self-hosting behind a proxy is expected.
8. **Placeholder email sender.** The default alert sender is `wwatch <beth.t@example.com>` (`src/alert.ts:25`). The README calls this "Resend's" default, but it is a placeholder at `example.com`.

## 2. Tests, CI, coverage

- **CI does not exist.**
  - There is no `.github/` directory.
  - The GitHub Actions API returns `total_count: 0` workflow runs.
  - There are 0 open issues and 0 open PRs on `aka-luan/wwatch`.
- **`main` is red on two of the README's four "Checks"** (`README.md`, "Checks" section):
  - `typecheck`: `scripts/audit-marketing-hero.ts` and `scripts/verify-ui-playwright.ts` import `playwright`, which is not in `package.json`. There are also four implicit-`any` errors.
  - `lint`: `scripts/audit-marketing-hero.ts:47` has a `no-explicit-any` error.
  - Introduced by `e32ee7b` and `5ef8d19` (2026-08-21). Nothing stopped them because there is no CI.
- **Coverage** (`tsx --test --experimental-test-coverage`).
  - The headline is 93.4% lines and 87.2% branches. **It is inflated**: it averages in the test files themselves and leaves out any file no test imports.
  - Real gaps:

| Area | Status |
|---|---|
| All 56 `.tsx` components and views (~9.3k lines), plus `web/lib/telemetry.ts` (13 kB) | 0 tests, not counted in coverage |
| `plugin/wwatch.php` (818 lines, the code that runs **as admin on customer sites**) | 0 tests, no PHP lint or static analysis |
| `src/server.ts` (the Node self-host entry) | 50% lines, 0% functions |
| `src/index.ts` (Vercel entry) | 66% lines |
| `src/scan.ts` | 81.6% lines / 73.7% branches. Gaps in redirect, TLS and site-health branches (`58-61`, `111-163`). |
| `src/fleet.ts` | 83% lines. The failure path of `#run` and the update/repair guards. |
| `web/lib/format.ts` | 45% lines |
| End-to-end | `scripts/verify.ts` runs **in-process** with injected `ScanDeps` (`scripts/verify.ts:151-169`), so it never exercises the real `serve()` path, the cookie auth flow, or a real scheduler. `scripts/verify-ui-playwright.ts` exists but cannot typecheck (missing dependency). |
| Real WordPress | Nothing runs against a real WordPress + PHP. There is no wp-env or Docker WP fixture. |

## 3. Gap matrix: wwatch vs Inngest

Status key:
- ✅ done
- 🟡 partial
- ❌ missing

Inngest sources:
- [I-README] github.com/inngest/inngest README
- [I-LIC] LICENSE.md
- [I-SH] inngest.com/docs/self-hosting
- [I-DEV] /docs/dev-server
- [I-PRICE] /pricing
- [I-SEC] /docs/learn/security
- [I-ENV] /docs/platform/environments
- [I-BLOG] /blog/inngest-1-0-announcing-self-hosting-support

### Core engine
| Capability | wwatch | Evidence | Inngest benchmark |
|---|---|---|---|
| Domain checks (core/plugin/theme updates, exposed files, TLS, XML-RPC, links, Site Health, helper health) | ✅ | `src/scan.ts`, `src/helper.ts`, README "What a scan checks" | n/a: Inngest's core is durable execution |
| Remote actions (update, repair, auto-login) | ✅ | `src/helper.ts`, `plugin/wwatch.php:32-90` | — |
| Durable job queue with retries | ❌ | Scans are a promise handed to `waitUntil` (`src/http.ts:259-267`, `src/fleet.ts:125-139`). A failure becomes a "Scan failed" finding with no retry (`src/fleet.ts:198-221`). The lock is a `jobs` row with a 3-minute stale timeout (`src/store.ts:34`). | Built-in queue with retries; in-memory Redis by default, external Redis optional [I-SH] |
| Scheduler | 🟡 | Vercel cron only (`vercel.json`). Nothing in `src/server.ts`. | Cron triggers are part of the engine; `--tick` and `--poll-interval` flags [I-SH] |
| Concurrency / backpressure | ❌ | `scan-all` starts every site at once with `Promise.all` (`src/http.ts:151`) | Concurrency controls, `--queue-workers` [I-SH], concurrent-steps plan limits [I-PRICE] |
| Run history and retention | 🟡 | Last 10 scans per site (`src/store.ts:38`). No retention setting. | Trace history 24h to 90d by plan [I-PRICE]. Self-hosted "does not automatically delete old database rows" [I-SH]. |
| Alerting | 🟡 | Telegram and Resend email, deduplicated against the previous scan, for a small set of finding kinds (`src/alert.ts`) | — |
| Uptime at 5-minute intervals, backups, Slack, "performance monitoring" | ❌ | Advertised in `web/marketing/pricing-section.tsx:83,86,87,146`. No code exists (no backup/restore/Slack code under `src/` or `plugin/`). | — |

### SDKs / API
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| Public, documented, versioned HTTP API | ❌ | `/api/*` is the private backend of the SPA. It is unversioned, cookie-auth only, and has no API tokens (`src/http.ts`). | REST API plus SDKs |
| SDK / client libraries | ❌ | — | TS, Python and Go SDKs under Apache-2.0 [I-README] |
| Agent (helper plugin), versioned protocol | ✅ / 🟡 | `wwatch/v1` with capability discovery via `/status` (`plugin/wwatch.php:37-90`). Distributed only as a zip from the board (`/api/helper-plugin`), not on wordpress.org, and unsigned (`SECURITY-REVIEW.md` #11). | SDK served by your app, signed requests [I-SEC] |
| Outbound webhooks / integrations | ❌ | — | Datadog and Prometheus export [I-SH][I-PRICE] |
| CLI | ❌ | — | `inngest-cli` [I-DEV] |

### Local developer experience
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| One-command run | ✅ | `npm start`, ~15 s from clone (§1) | `npx inngest-cli@latest dev` [I-DEV] |
| Watch mode | ✅ | `npm run dev` | — |
| Try it without real infrastructure | ❌ | The fake WordPress only lives inside `scripts/verify.ts`. There is no `npm run demo` or seeded fake site to add from the UI. | Dev server with test events, invoke, replay, traces [I-DEV] |
| Contributor checks green | ❌ | typecheck and lint fail on `main` (§2) | — |
| Lands on the product | ❌ | `/` is marketing (`src/server.ts:15`, `web/index.html`) | Dev UI at :8288 [I-DEV] |

### Self-hosting / deployment
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| Single process + embedded DB | ✅ | `src/server.ts`; SQLite at `data/watch.db` (`src/store.ts:41-56`) | Single binary, SQLite default [I-SH] |
| External / shared DB | ✅ | Turso / libSQL (`src/store.ts:42-48`) | `--postgres-uri`, `--redis-uri` [I-SH] |
| Docker image / compose / Helm | ❌ | No Dockerfile | Docker `inngest/inngest`, compose example, Helm chart [I-SH] |
| Startup config validation | 🟡 | Vercel entry only (`src/index.ts:8-22`). The Node entry checks nothing. | Flags and env vars, required keys [I-SH] |
| Secure defaults | ❌ | Plaintext credentials without a secret (`src/store.ts:310`); board open without a password (`src/http.ts:52-55`) | Signing key required for self-hosted [I-SH] |
| Health / metrics endpoint | ❌ | `/api/health` returns 404. Logging is a single `console.log` (`src/server.ts:26`). | `/metrics` Prometheus [I-SH] |
| Schema migrations | 🟡 | `CREATE TABLE IF NOT EXISTS` only (`src/store.ts:257-291`), plus one ad-hoc reseal migration (`src/store.ts:340-356`). No version table. | — |
| Release artifacts / versioning | ❌ | `"version": "0.1.0", "private": true` (`package.json`). No tags, releases or changelog. | Roughly 2–4 minor releases a month, binaries, CHANGELOG.md [I-README, releases page] |
| Scaling | 🟡 | Stateless with Turso, but scans run inside the request process with a 60 s cap (`vercel.json`) | Add replicas; KEDA/HPA in Helm [I-SH] |

### Docs
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| README accuracy for features | ✅ | `README.md` matches the code I read | — |
| Self-host guide (VPS, proxy, TLS, backup, upgrade) | ❌ | Vercel-centric `README.md`. Self-host detail only in `AGENTS.md`. | Full self-hosting page [I-SH] |
| Configuration reference | 🟡 | Env vars are scattered through README prose | Flag table [I-SH] |
| API / protocol reference | ❌ | Helper protocol is described in prose only | Docs site |
| LICENSE | ❌ | No file | [I-LIC] |
| SECURITY.md (disclosure policy) | ❌ | `SECURITY-REVIEW.md` is an audit, not a reporting channel | SECURITY.md → security@inngest.com |
| CONTRIBUTING / CHANGELOG / Code of Conduct | ❌ | — | docs/CONTRIBUTING.md, CHANGELOG.md |

### Security
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| Board sessions | ✅ | HMAC cookie with a key from `WATCH_SECRET`, server-side revocation, login rate limit (`src/http.ts:51-80,220-245,306-345`, `SECURITY-REVIEW.md` #1, #5, #6) | — |
| Credential encryption at rest | 🟡 | AES-256-GCM with a per-row scrypt key (`src/wrap.ts`), **but only if a secret is set**; otherwise plaintext (`src/store.ts:310`) | Encryption at rest; client-side encryption middleware [I-SEC] |
| SSRF | 🟡 | Private, link-local and metadata ranges blocked; DNS resolved before fetch; redirects manual (`src/domain.ts`, `src/scan.ts:69-87,526`). **Loopback is deliberately allowed** (`src/domain.ts:217-218`, `src/scan.ts:74`). That is fine for one operator but must be closed for multi-tenant hosting. | — |
| CSRF | 🟡 | SameSite=Lax only (`SECURITY-REVIEW.md` #7, open) | — |
| Headers / CSP | ✅ | `src/http.ts:9-49` | — |
| Board ↔ agent authentication | 🟡 | WordPress Application Password over HTTPS (Basic auth). No request signing, no timestamps. | Every request signed with a per-environment key, timestamped against replay, zero-downtime rotation [I-SEC] |
| Plugin least privilege | ✅ | Per-action capabilities in helper 1.4.0 (`plugin/wwatch.php:92-140`) | — |
| Dependency hygiene | ❌ | **hono 4.13.2** has 5 advisories, including GHSA-5r4p-p66f-jhc7 (`serveStatic` middleware bypass, fixed in 4.13.11; latest 4.13.14). `npm audit --omit=dev`: 14 vulnerabilities (1 critical). | — |
| Compliance | ❌ | — | "SOC 2 Type II compliant" [I-SEC]; HIPAA add-on [I-PRICE] |

### Hosted-platform layer
| Capability | wwatch | Evidence | Inngest |
|---|---|---|---|
| Multi-tenancy | ❌ | The schema has `sites`, `scans`, `jobs`, `login_failures` and `revoked_sessions`, with **no tenant or user column** (`src/store.ts:257-291`) | Accounts and environments with separate keys [I-ENV] |
| Auth (users, invites, SSO, RBAC) | ❌ | One shared password for the board (`src/http.ts:220-233`) | Seats 5 to 30 by plan; SAML, RBAC and audit trails on Enterprise [I-PRICE] |
| Billing | ❌ | Pricing UI only: $19/mo "10 sites" and $79/mo (`web/marketing/pricing-section.tsx:70,129`) | Free / $99 / $499 / Custom [I-PRICE] |
| Usage limits | ❌ | "10 sites" is not enforced anywhere | Executions, events and concurrency, with a hard pause on Free [I-PRICE] |
| Observability (of the platform) | ❌ | No structured logs, metrics, error tracking or status page | Metrics with granularity and retention by plan; Datadog add-on [I-PRICE] |
| Onboarding | 🟡 | A good add-site flow with header-stripping diagnostics (`web/components/add-site-dialog.tsx`, `src/scan.ts` `describeAuthFailure`). No signup or verification. | — |
| Worker isolation | ❌ | Scans run in the web function (`vercel.json` `maxDuration: 60`) | Separate execution tier [I-SEC] |
| Environments (staging / prod) | ❌ | — | Production, custom and branch environments [I-ENV] |
| Audit log, data export and deletion, ToS / DPA | ❌ | — | Audit trails on Enterprise [I-PRICE] |

## 4. Licensing and dependencies

### Current state
- **No LICENSE file.** By default that means all rights are reserved, so nobody may use, fork or deploy it. `package.json` also has `"private": true`.
- **Plugin header** says `License: MIT` (`plugin/wwatch.php:8`).
- **Copyright.** History covers 73 commits, 2026-08-13 → 08-22. Authors:
  - Luan Felipe Britto Alves: 35
  - Cursor Agent: 21
  - Luan: 9
  - Claude: 8

  No outside human contributors, so the owner can choose any license now without anyone else's consent. Do it **before** accepting outside PRs, and add a DCO or CLA at the same time. (Not legal advice. Have counsel confirm ownership of agent-authored commits.)

### Dependency licenses
These come from `package-lock.json` plus each package's `package.json`.

- **Production:** 312 MIT, 24 ISC, 8 BSD-3, 6 Apache-2.0, 5 BSD-2, 2 BlueOak, 1 0BSD, 1 Python-2.0, 1 CC-BY-4.0, and 1 **OFL-1.1** (`@fontsource-variable/inter`; fine, keep its notice).
- **Development:** includes 24 MPL-2.0 entries (`lightningcss` builds, a build tool that is not redistributed).
- **Copyleft:** none in the shipped tree that would conflict with any license choice below.

### Dependency hygiene
- **Upgrade `hono` to ≥ 4.13.11** now.
- **Move `shadcn` to `devDependencies`.** It is a scaffolding CLI, and pulls express, `@modelcontextprotocol/sdk` and zod into the prod audit. Only its CSS is consumed, at build time (`web/styles.css:11`).
- **Bump `concurrently`** (critical, via `shell-quote`; dev only).
- **Keep `three` out of the board bundle.** It is only used by the marketing hero (`web/marketing/*-scene.tsx`).

### Recommendation

| Component | License | Why |
|---|---|---|
| Server + board (`src/`, `web/` minus marketing) | **FSL-1.1-ALv2** (Functional Source License, converts to Apache-2.0 two years after each release) | Same shape as Inngest's choice: source-available now, Apache-2.0 later. Inngest's is "Server Side Public License" with a grant "under the Apache License, Version 2.0, that is effective on the third anniversary" [I-LIC], and its 1.0 post says it was "inspired by the fair source license initiative" [I-BLOG]. FSL is shorter than SSPL, written for exactly this case, and its summary is "You can do anything with FSL software except undermine its producer" (fsl.software). SSPL is not OSI-approved and is on many corporate deny-lists, which would hurt agency adoption. |
| Alternative if you want to mirror Inngest exactly | SSPL-1.0 with an Apache-2.0 future grant after 3 years [I-LIC] | Proven, but heavier. SSPL §13 obliges anyone offering the software "as a service" to publish their whole stack. |
| Helper plugin (`plugin/`) | **GPL-2.0-or-later** (MIT also acceptable) | It runs inside WordPress. The wordpress.org guidelines require "any GPL-compatible license" and recommend "GPLv2 or later". **FSL and SSPL are not GPL-compatible**, so the plugin must not take the server's license. Guideline 5 also forbids locking plugin features behind payment, so the plugin must be identical for OSS and Cloud. Guideline 6 allows SaaS-backed plugins if the service is documented with terms. (developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) |
| Future API client / SDK / OpenAPI spec | Apache-2.0 | As Inngest does for SDKs: "All Inngest SDKs are all available under the Apache 2.0 license" [I-README] |
| Marketing site, logo, name | Not licensed; separate trademark policy | Most of the hosted offering's protection comes from the name, not the code |

Before adopting FSL, one wording question must be settled. Agencies are your core users. Under FSL, an agency using wwatch internally to care for client sites should be permitted use. Reselling wwatch logins to clients as "our monitoring product" may count as Competing Use. Write a FAQ that says which side of the line each case falls on. I could not fetch FSL's verbatim "Competing Use" text (see §10).

## 5. Open-source vs cloud-only split

Principle, taken from Inngest:
- **The self-hosted product is the whole product for one team.** Inngest's dev server is "a fully-featured and open-source local version of the Inngest Platform" [I-DEV], and self-host is the same binary [I-SH].
- **Cloud sells operation, scale, collaboration and compliance.** Inngest gates seats, retention, metrics granularity, SAML, RBAC, audit trails, Datadog and HIPAA [I-PRICE], not the engine.
- **Never gate security findings.** That would destroy trust, and the checks are easy to copy anyway.

| Open source (self-host) | Cloud only |
|---|---|
| Every scan check, including helper health | Multi-tenant workspaces, multiple users, invites |
| Helper plugin with updates, repair and auto-login (must be identical everywhere, per WP.org guideline 5) | RBAC, SSO/SAML, audit log |
| Fleet board, bulk updates, scan history | Managed probes at high frequency (1–5 min) from multiple regions, needing infrastructure you run |
| Built-in scheduler (daily or configurable) | Long history retention, trend reports, SLA/uptime reports |
| Telegram, email and webhook alerts | Client-facing / white-label reports for agencies |
| Single-operator auth (password or one admin account) | Managed alert channels (SMS, on-call integrations), Slack app |
| SQLite or libSQL/Turso, Docker image | Billing, usage plans, support SLA, DPA / compliance |
| Public API with a personal token | Org-level API keys, Datadog / Prometheus export of fleet metrics |

## 6. Two definitions of "done"

### OSS release is done when:
1. **Licensed.** `LICENSE` (FSL-1.1-ALv2) is at the root, `plugin/` is GPL-2.0-or-later, `package.json` has a `license` field, and a NOTICE lists the OFL font.
2. **Secure by default.**
   - The Node entry refuses to start, or auto-generates and persists a `WATCH_SECRET` with 0600 permissions, before storing any credential.
   - No credential is ever stored in plaintext.
   - It refuses to bind a non-loopback host without a board password.
   - It never uses the board password as the encryption key.
3. **Monitors on its own.** Node mode runs scheduled scans with no external cron.
4. **Serves the product.** Self-host serves the board at `/`; marketing is not shipped in the OSS build.
5. **Two documented install paths:** `npm` with a Node version in `engines`, and `docker compose up`. Both go from zero to a first scan of a real site in ≤ 15 minutes.
6. **Docs:**
   - self-host guide (VPS, reverse proxy + TLS, `TRUST_PROXY`)
   - complete env-var reference
   - backup / restore / upgrade
   - helper plugin guide
   - troubleshooting
   - SECURITY.md (disclosure), CONTRIBUTING (DCO), CHANGELOG
7. **CI green on `main`:** test, typecheck, lint and verify run on every PR, plus a production-dependency audit with no high or critical findings, plus a PHP lint of the plugin.
8. **Released.** A tagged release `v0.x`, with a container image published.
9. **Stranger test passed** (§9).

### Hosted platform is done when:
1. **Tenancy.**
   - Accounts with signup, email verification, password reset or magic link.
   - Workspaces, with `tenant_id` on every table and every query.
   - An automated cross-tenant isolation test suite.
2. **SSRF hardened for hosting.** Loopback blocked in hosted mode; scans run in isolated workers with egress restrictions.
3. **Durable execution.** Scans run off the request path with retries, timeouts, per-tenant concurrency, and a scheduler at plan cadence.
4. **Key management.** Credentials encrypted under a KMS-held key, with rotation.
5. **Billing and limits.** Plans and limits enforced (site count, scan frequency); a free tier; billing provider integrated.
6. **Operational visibility.** Structured logs, error tracking, scan-failure-rate alerting, a public status page, and platform DB backups with a tested restore.
7. **Legal.** ToS, privacy policy, a DPA (you hold admin credentials to customer sites), and account deletion and export.
8. **Honest marketing.** The marketing and pricing page lists only shipped features.
9. **Beta test passed** (§9).

## 7. Gaps ranked by what blocks the first real user

**P0: blocks the first user.**

| # | Gap | Blocks | Fix size |
|---|---|---|---|
| 1 | No LICENSE (§4) | OSS | S |
| 2 | Plaintext admin credentials by default; board password used as encryption key; no bind guard (`src/store.ts:310`, `src/wrap.ts`, `src/server.ts`) | OSS + Hosted | S |
| 3 | No scheduler outside Vercel (`vercel.json` only), so a monitor that doesn't monitor | OSS | S |
| 4 | Marketing advertises nonexistent features and prices (`web/marketing/pricing-section.tsx`) | Both: trust and possibly consumer-law exposure | S |
| 5 | No users or tenants (`src/store.ts:257-291`) | Hosted | L |
| 6 | Scans tied to a 60 s request; no queue or retries (`vercel.json`, `src/fleet.ts`) | Hosted (and big self-host fleets) | M–L |
| 7 | Loopback SSRF exception (`src/domain.ts:217`, `src/scan.ts:74`) | Hosted | S |
| 8 | hono advisories, including the `serveStatic` middleware bypass | Both | S |

**P1: blocks the first week.**

| # | Gap | Blocks | Fix size |
|---|---|---|---|
| 9 | `/` serves marketing; the README never mentions `/app` | OSS | S |
| 10 | No CI; typecheck and lint red on `main` | OSS contributors | S |
| 11 | No Docker image or self-host guide | OSS | M |
| 12 | No billing or limit enforcement | Hosted | M |
| 13 | No SECURITY.md, CONTRIBUTING, CHANGELOG or releases | OSS | S |
| 14 | No health endpoint, logging or metrics | Both | S–M |
| 15 | Plugin not on wordpress.org; zip unsigned (`SECURITY-REVIEW.md` #11) | Both | M (review queue time) |

**P2: blocks growth.**

16. Public API with tokens, outbound webhooks, Slack
17. CSRF token (#7 open)
18. Migration versioning
19. Retention controls
20. Demo mode with a fake site
21. Tests for the PHP plugin and the components
22. Placeholder `example.com` alert sender

## 8. Milestone plan

Sizes are my estimates for one experienced developer, not commitments.

### Open source
- **OSS-M0 "Legally and safely usable"** (~1 week). Covers P0 #1, #2, #3, #8 and P1 #9, #10.
  - Add LICENSE files.
  - Secure defaults in `src/server.ts`.
  - In-process scheduler.
  - hono upgrade.
  - Fix or exclude `scripts/*playwright*` from typecheck and lint.
  - Add a GitHub Actions workflow.
  - Serve the board at `/` when self-hosted.
- **OSS-M1 "Self-hostable by a stranger"** (~2 weeks). Covers P1 #11 and #14.
  - Dockerfile and `docker-compose.yml` with a volume for `data/`.
  - `/healthz`.
  - Config validation in Node mode.
  - `engines` field.
  - Docs: VPS + Caddy/nginx, env reference, backup and upgrade.
  - Remove the dependency bloat.
- **OSS-M2 "Public v0.2.0"** (~1 week). Covers P1 #13 and P0 #4 (for the OSS site).
  - SECURITY.md, CONTRIBUTING with DCO, CHANGELOG.
  - Tagged release and container image.
  - Plugin relicensed GPLv2+ and submitted to wordpress.org.
  - Honest landing page.
  - Run the stranger test with 3 people and fix what they hit.
- **OSS-M3 "Integrable"** (later). Covers P2 #16–#21.
  - Token-auth versioned API and OpenAPI spec (Apache-2.0).
  - Webhooks and Slack.
  - CSRF tokens.
  - Migrations.
  - Retention.
  - Plugin tests (wp-env).

### Hosted
- **H0 "Architecture decisions"** (~1 week). Choose:
  - the tenant model (shared DB with `tenant_id`, or per-tenant DB, which Turso makes cheap);
  - the worker and queue runtime (anything durable, including Inngest itself);
  - the auth provider;
  - the KMS.

  Write these down as ADRs.
- **H1 "Multi-tenant core"** (~3–4 weeks). P0 #5 and #7.
  - Users, workspaces and sessions.
  - `tenant_id` everywhere, with an isolation test suite.
  - Hosted-mode SSRF rules.
  - KMS-wrapped credentials.
- **H2 "Runs without you"** (~2–3 weeks). P0 #6 and P1 #14.
  - Queue workers with retries and per-tenant concurrency.
  - Plan-cadence scheduler.
  - Logs, error tracking, alerting, status page, DB backups.
- **H3 "Can take money"** (~2 weeks). P1 #12 and P0 #4.
  - Billing provider, plan enforcement, free tier.
  - Pricing page rewritten to shipped features.
  - ToS, privacy policy, DPA.
- **H4 "Closed beta"** (~4 weeks elapsed).
  - 3–5 agencies with real client sites.
  - Onboarding funnel instrumented.
  - Support channel.
  - Run the beta test.

H1 can start in parallel with OSS-M1. OSS-M0 should land first, because the hosted product will be built on the same secure defaults and CI.

## 9. Acceptance tests

### OSS: the stranger test
Give someone who has never seen the repo only the public docs URL and a fresh Linux VPS. No contact with the maintainer. Within **30 minutes** they must:
1. Install via Docker or npm, with the board behind HTTPS and a password.
2. Connect their own WordPress site, install the helper plugin from the board, and see a completed scan with helper findings.
3. Receive the **next scheduled scan the following day** without touching anything.
4. Get a Telegram or email alert after creating a public `debug.log`, and clear it with **Fix**.
5. Upgrade to the next tagged release with history intact.

**Pass:** zero maintainer help, every stall logged and fixed in the docs. `sqlite3 data/watch.db "select application_password from sites"` shows only `v2:` ciphertext.

### Hosted: the beta test
One beta agency, not hand-held, with at least 5 real client sites must:
1. Sign up, verify email, and create a workspace.
2. Add all sites and install the helper on them.
3. Apply a **real plugin update from the board** and see the post-update scan.
4. Receive a real alert.
5. Enter payment and land on the plan that matches their site count.

Over 7 days, the scheduled scans must run at plan cadence with no unexplained job failures in platform telemetry. At the same time, a second test tenant's attempt to read the first tenant's sites, scans or credentials (through both the UI and direct API calls with swapped IDs) must fail. The isolation test suite must be green in CI.

## 10. What I could not verify

- **Real WordPress scans.** I had no real WordPress site. End-to-end scanning was only exercised through `npm run verify`'s in-process fake and the real server's error paths. The PHP plugin was read, not executed.
- **Vercel / Turso deployment.** No accounts, so this path is untested.
- **Alert delivery.** Telegram and Resend were not exercised live.
- **Other platforms.** Install was not tried on macOS, Windows, or any Node other than v22.22.0.
- **Repository visibility.** I don't know whether the repo is public; my clone went through this session's authenticated proxy.
- **Inngest details:**
  - whether contributors sign a CLA;
  - whether self-hosted lacks RBAC, SSO or multiple environments (their docs are silent, not explicit);
  - the encryption-middleware algorithm;
  - exact star and release counts (GitHub API refused; HTML showed about 6.0k stars).

  Inngest facts above come from pages fetched today and quoted where marked.
- **FSL wording.** fsl.software's summary page did not include the verbatim "Competing Use" and "Permitted Purpose" text. Read the license text itself before adopting it.
- **Legal.** None of this is legal advice. That includes the ownership of agent-authored commits and whether the marketing claims create consumer-law exposure.
- **Plan sizes.** Milestone durations are estimates.
