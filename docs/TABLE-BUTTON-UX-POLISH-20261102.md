# Table and action hierarchy refinement — 2026-11-02

Scope: Long requested iterative improvement after reviewing the current table/button colors and borders. Existing feature worktree and all WIP are preserved. No Backend, API contract, JWT/RBAC, business validation, SQL configuration or cloud changes. No source commit, push or main merge in this batch.

## Presentation changes

- Retain navy identity and emerald primary actions. Add scoped table heading/divider and secondary-action tokens to the existing V3 palette.
- Readable 13px sentence-case table headings replace 11px uppercase/letter-spaced headings. Native table semantics, sticky headings, horizontal table scrolling, selection and handlers remain.
- Remove the extra table shadow. Keep one quiet table frame, softer row dividers, 56px minimum row rhythm and consistent mint hover/keyboard focus. Selection still has a stronger background and left indicator.
- Flatten V3 filter toolbars: remove the nested shaded frame, retain one bottom separator and honest result-count/filter-scope text. Keep all controls, labels, submit/clear handlers and responsive wrapping.
- Secondary buttons use quiet slate text/borders without shadows. The initial flat emerald row-action treatment was rejected by Long and superseded by the outlined action correction in ACTION-AFFORDANCE-REVIEW-20261102.md. Primary/destructive actions retain their meanings and pending/disabled behavior.
- Use an explicit 2px keyboard outline so the primary button's elevation cannot mask focus. Keep reduced-motion support and suppress pressed movement when reduced motion is requested.
- Horse registry replaces oversized count/page KPI cards with a compact loaded-row count and labelled pagination. Exact server total remains in the toolbar; actual page and loaded row count are separate. No changes to queries, page size, permissions or destinations.
- After screenshot review, exercise cards use content height and responsive auto-fill columns rather than a fixed 246px inner minimum. The footer has a clear separator; long text wraps and existing View/Choose actions remain.

## UX defect found during review

The actual Exercise drawer lost focus when closed because its parent unmounted it while open. The shared native-dialog hook now closes on effect cleanup and restores the connected, enabled opener when focus was in the closing dialog or body. It avoids explicitly replacing another active control's focus. Native modal behavior and owner-controlled dismissible/dirty guards remain.

Four new regressions cover conditional Modal/Drawer closure by button and Escape. Existing dirty-overlay tests still pass. Actual browser checks verify both Exercise drawer close paths and the Stable Box modal Escape path, without saving anything.

## Verification actually run

| Evidence | Result |
|---|---|
| First focused group: shared components/table/toolbar, Horse application/journey, Medical integration, precheck and navigation | 132 tests / 8 files PASS, including three new honest-count/pagination cases |
| Component and Training supporting checks | 29 tests / 2 additional files PASS |
| Final overlay/component/Training/Horse group | 62 tests / 4 files PASS; overlaps the earlier groups except Foundation's 12 tests |
| Distinct focused coverage for this batch | 173 tests / 11 files; not a full-suite result |
| Final TypeScript, full ESLint, Vite production build, production bundle guard, diff check | PASS; only existing unrelated LF/CRLF normalization warnings |
| Initial browser audit with new shared table/button styles | 49 representative role/route renderings across all seven roles PASS: no unfinished loading, document overflow, unlabeled visible input, unnamed button, uncaught page error or API HTTP failure |
| First interaction run before the final overlay correction | 40 checks / 43 actual API requests PASS, four viewport sizes across all seven roles, primary/header text contrast, keyboard focus, real Horse search/empty/clear, row navigation and reduced motion |
| Final Exercise card/drawer check | 7 checks / 5 actual API requests PASS; four widths, real detail read, original Trainer edit action, close and Escape return focus. Card is 368 x 253px at 1440px viewport |
| Final combined interaction run | PARTIAL: first six roles complete; Owner list exceeds the harness's 10-second loading check in two consecutive attempts |
| Separate real Owner check after that failure | 12 checks / 14 actual API requests PASS, including list/Health at four widths, DRAFT clarification and tabs |

Browser tests use the real API-only build, local JWT authentication and existing SQL-backed data. They do not mock requests or submit business mutations. Auth login/audit side effects are expected. Temporary isolated browsers close in finally blocks.

The final combined failure is not labelled PASS or hidden by increasing the timeout. Metadata shows Owner list HTTP 200 and several training-summary HTTP 200 responses while the aggregate list still loads. The cause of the remaining delay is UNKNOWN; the isolated Owner check completes. No Backend or SQL configuration is changed to conceal it.

Final CSS changes after the 49-route run affect Exercise card layout only; the additional shared hook change affects dialog focus. Those changes receive the targeted checks described above rather than another mechanical full route scan.

## Local evidence and limits

Private local evidence under .preview-local/racehorse-training:

- ux-audit-table-polish.json and ux-table-polish-*.png.
- table-polish-interactions.json (earlier successful 40-check run).
- table-polish-interactions-failed.json and table-polish-failed.png (final combined failure and completed checks).
- exercise-card-polish.json/png and owner-readiness-ui.json/png.
- table-polish-build.log and table-polish-final-build.log.

The previous ux-role-polish-after-* screenshots are the before comparison for table hierarchy; they are not screenshots of a different application's design. Database descriptions marked SIMULATED remain visible and are not rewritten as real events.

No claim of all-modal/all-state E2E, complete accessibility certification, browser-toolbar zoom coverage, load testing or Independent Gate. The intermittent Owner aggregate loading delay remains a real review limitation.

## Using the shared styles

- Keep one primary action per action group; use secondary for supporting actions, tertiary for low-emphasis navigation and destructive only for the existing destructive workflow.
- Keep explicit button labels and native link semantics. Secondary table actions retain visible outlines, their actual hit area and keyboard focus. Reserve unframed tertiary treatment for genuinely low-priority actions.
- Keep true server/page filter scope and result totals supplied by the feature. Do not infer a database total from loaded rows.
- Do not use emerald alone as a business readiness decision. Lifecycle, health and availability remain independent facts.
- V3 table/toolbar/card styling is scoped. Existing V1 presentation is retained; the shared focus-outline and native-dialog lifecycle improvements apply across scopes.
