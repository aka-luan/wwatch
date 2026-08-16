# Site list redesign — structural plan

## Findings from the codebase (before writing code)

- `Finding.severity` already exists (`"info" | "warn" | "crit"`) — no data-shape stop condition on severity.
- The primary status filter (`SiteFilterState.status`) already lives as local React state in `app.tsx` and is
  already wired to clickable chips in `SiteFilters`. Turning the summary counters into filters needs no new
  global state — it reuses `statusFilterCounts` / `onChange`.
- Backend finding titles/details (`src/scan.ts`, `src/domain.ts`) are already English-only. No pt-BR strings
  exist anywhere in the current tree. Requirement 7 is addressed by centralizing the *new* UI copy this redesign
  introduces into `web/lib/copy.ts` (one locale, one place), not by translating a mixed corpus that doesn't
  exist in code today.
- `OverviewRow` already carries `latest.finishedAt` and `running`, enough to compute staleness client-side
  without touching the scan/API layer.

No stop condition is triggered.

## Deleted

- `web/components/site-sheet.tsx` (side drawer)
- `web/components/updates-review.tsx` (fleet "Review updates" modal + entry pill)
- Their `*.test.ts` if any (none exist — sheet/review had no dedicated lib tests, logic lived in `fleet-updates.ts`
  which is kept).

## New

- `web/lib/site-status.ts` — `staleHours`, `staleLabel`, `effectiveStatus` (findings status bumped to at least
  "attention" when the last successful scan is >48h old and nothing is running). Single source of truth used by
  `site-overview.ts`, `site-filters.ts`, and (transitively) `site-board.ts`.
- `web/lib/copy.ts` — centralized English strings for the new summary bar, row expansion, and add-site steps.
- `web/components/site-row.tsx` — dense row (3px left border only, `border-radius: 0`) + inline expansion panel
  (actions, scan banner, needs-action findings with inline action buttons, collapsed informational findings,
  scan history, plugin list). Replaces the old `SiteRow` in `site-list.tsx` and everything `SiteSheet` did.
- `web/components/site-summary-bar.tsx` — "N critical · N attention · N healthy" clickable counters (reuses
  `statusFilterCounts`/`effectiveStatus`) + primary "Update all N" button (reuses `fleetUpdateSummary` +
  `/api/sites/:id/update`, confirmed via the existing `AlertDialog` pattern — not a new overlay type).

## Changed

- `web/lib/status.ts` — untouched (kept pure, finding-only). Staleness lives in the new `site-status.ts` wrapper
  so existing `siteStatusOf` call sites/tests keep working.
- `web/lib/site-overview.ts` — use `effectiveStatus` instead of `siteStatusOf`; add `staleLabel` to
  `SiteOverview`; surface it as the primary label when a site is otherwise healthy but stale, otherwise fold it
  into `extra`.
- `web/lib/site-filters.ts` — use `effectiveStatus` in `statusFilterCounts`/`matchesStatus` so filter counts,
  filtering, and row status agree with the staleness bump.
- `web/lib/site-board.ts` — `compareBoardSites` gains a recency tiebreaker (most recent `finishedAt`/
  `running.startedAt` first) within the same status, per requirement 5. Status-then-recency-then-name.
- `web/lib/finding-groups.ts` — add `siteActionabilityGroups(findings)`: reuses the existing
  `toDisplayFinding`/`collapsedBrokenLinks`/`dedupeDisplayFindings`/`compareDisplayFindings` helpers to produce
  `{ needsAction, informational }` instead of the five category sections. `siteFindingSections` stays (still
  covered by its own tests) since nothing else needs to change there.
- `web/components/site-list.tsx` — rows sorted critical → attention → healthy (unchanged grouping), rendered
  with `SiteRow`; single-expansion model (`selectedId`/`selectedPage`) ported from `app.tsx`, no drawer.
- `web/components/add-site-dialog.tsx` — instructions become a numbered 3-step `<ol>`, still behind the existing
  collapsible trigger.
- `web/app.tsx` — drop `SiteSheet`/`UpdatesReviewDialog`/`UpdatesEntry` wiring; mount `SiteSummaryBar` in the
  toolbar; keep `selected`/`page` fetch-on-open logic (now driving inline expansion instead of a sheet).
- `web/styles.css` — remove now-unused `.updates-entry*` rules if nothing else references them; add row
  border-left tone classes if not expressed purely via Tailwind.

## Out of scope (per PROIBIDO / task boundary)

- No changes to `src/*` (scan/API layer).
- No new modal/drawer/overlay component kind — existing `AlertDialog`/`Dialog` usages for single-action
  confirmations (update/remove/edit-credentials) are kept as-is (they already existed and are not a duplicate
  status surface); only the two enumerated surfaces (site drawer, updates modal) are deleted in favor of inline
  expansion.
