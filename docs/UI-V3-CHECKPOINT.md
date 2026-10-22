# UI v3 — full migration in progress

## CURRENT STATE (Claude takeover, 2026-10-22 evening) — read first

- Batches 1–7 are COMMITTED (0904759 … a000c39); the "uncommitted" notes below are historical.
- Batch 8 (integration) in progress on `design/ui-v3`, commits after a000c39:
  - 47e84dc tests: greeting assertion accepts any local-time greeting, rider button is "Select Test Rider",
    regex escapes removed, rider dashboard uses mounted `now` (no render-time Date.now). Full lint now CLEAN.
  - 7c21037 bare action/back links → ButtonLink (same `to`), case status badge (`medicalCase` OPEN/CLOSED),
    V3 base style for class-less inline links.
  - db81871 incident handling strip (span rule hit StatusBadge internals), sentence-case incident types,
    treatment plan start time formatted.
  - 4d47c35 horse profile status badges compact (shared `.row > * { flex: 1 }` stretched them).
- Stitch: no Stitch MCP server is configured in this session; the saved reference
  `_gate-monitor/stitch-horse-dossier-reference.html` (tailwind tokens + shell) is the visual source.
- Browser review with real JWT (original DB, read-only browsing, no business writes):
  VETERINARIAN — dashboard, horses list, horse profile + Pedigree & History, baseline form, medical cases,
  case detail, treatment plan, herd health, incidents list/detail, restrictions, notifications, account: PASS
  after the fixes above.
  HEAD_TRAINER — dashboard, templates, program list/detail/create wizard, adjustment requests, training
  calendar, performance, live monitoring, medical summary, restrictions: PASS after 39ec6d6 (sidebar ellipsis,
  quiet unavailable metrics), e84afc9 (header overflow at desktop), 7a54d08 (Live Monitoring role nav) and the
  wrapping wizard stepper.
  TRAINER — dashboard, assigned programs, calendar, exercise library + New Exercise dialog, session wizard,
  session detail, live monitoring (session 7), session evaluation: PASS after 90fde2e (table columns keep
  content width, fit-content badges, nowrap date columns) and 628fe81 (unique chart axis keys).
  GROOM — Today, Care Tasks, pre-session check (session 7), Incidents, Report Incident dialog (not submitted): PASS,
  no new defects.
  WORK_RIDER — My Rides, Assignments (Today/Upcoming/Completed), Riding History, Report Issue entry: PASS after
  05b9070 (one active sidebar item when two entries share a route; tab bars no longer scroll vertically).
  HORSE_OWNER — portal dashboard, My Horses (list + search), horse detail Profile & Pedigree / Health & Readiness
  / Training & Performance (ACTIVE, DRAFT, LOCKED and a horse with completed sessions), notifications: PASS after
  5faf938 (long session codes wrap instead of overlapping the distance column).
  Pending sign-in: Club Manager.
- Known data-level display limits (not styling): incident "Reported by" shows a user id (API returns ids only);
  owner list card says "No program shared" for a horse whose detail shows its program (list summary payload).
- Existing behaviour kept: sidebar NavLinks use `end` (as on main), so detail routes do not highlight the parent
  list item.

Base: `55f85518b7422e3cc32f8953fa3877ad6fe37ef4` (FE main).
Branch: `design/ui-v3`. Worktree: `_gate-monitor/fe-ui-v3`.

## Implemented preparation

The existing token stylesheet exposes the Leader's four approved colours and
Inter / Plus Jakarta Sans typography. Plus Jakarta Sans 5.3.0 is pinned and
self-hosted (600/700/800); existing lockfile platform metadata is preserved.
The Leader approved Login, Horse List and Registration, then authorized the full
eight-batch migration without repeated approval. The document now opts every route
into V3. Nested v2 scopes share the approved palette. Brand accents do not replace
clinical semantic colours. Existing components, handlers and contracts remain.

The existing Sidebar/Header and Button/Field/DataTable/MetricCard styles adapt
only within the selected screens' shell. Card radius/elevation use the same token
file; no second component library. TSX changes add styling markers only. No
business data, fields, controls, content, handlers, hooks, API, routes or guards
were changed. No new app, sample store, Backend, SQL or cloud changes.

## Required source

Official reference is now accessible:
https://stitch.withgoogle.com/projects/9531024772491706807
Read its Equestrian Performance Command foundation and Horse Dossier reference
in the browser, including the read-only code view. Reference HTML is kept outside
the repository at `_gate-monitor/stitch-horse-dossier-reference.html`; it is not
executed or substituted for React. Extracted typography: headlines32/40,
medium24/32, small20/28; body14/20 and12/16; Inter labels11/14; rounded8/12px,
white sidebar/cards, navy selected navigation, light neutral surfaces, subtle
shadows, dark action buttons. The Leader's explicit brand palette takes precedence
over generated black/derived colour values in the sample. No fictional content
or sample controls were copied.

## First visual approval batch

Existing screens: Login (`/login`), Horse List (`/horses`) and Horse Registration
(`/horses/new`). They retain functional layout/content order. After recovering
the original environment and verifying its source, only the identified FE Vite
process was replaced with this design worktree on http://localhost:5173.
API base remains `/`, proxied to the existing BE8080. No CORS policy was changed.
The clean original FE main checkout is preserved; its restart command is recorded
in `_gate-monitor/ui-v3-evidence/frontend-main-rollback.json`.
The Leader's three-screen visual approval has been received. Continue all batches.

Stitch is the global visual guide. Missing frames are not blockers: after approval,
restyle the existing screen's pattern without inventing or removing functionality.

Source inventory: `UI-V3-ROUTE-INVENTORY.md`, 76 path/view declarations including
aliases/development/conditional entries, not76 independent business screens;
31 shared component directories. No route was added or removed.

Use existing shared controls and preserve validation, errors, focus, responsive
navigation, role access and API-only behaviour. No Backend, SQL, main merge or
deployment work is part of this task.

## Verification of preparation

- Design/source-preservation policy checks: 24/24 PASS. TypeScript AST equality
  after stripping only the new styling markers proves the four changed TSX files
  preserve content, handlers, hooks and accessibility semantics. Pinned comparison
  also verifies router, URLs, navigation, Header/Sidebar markup, auth/client/session
  and horse API adapter unchanged.
- Changed script lint, TypeScript, production build/bundle guard and diff check: PASS.
- Focused tests:109/111 PASS across6 files. Two unchanged horseFlow assertions
  expect "Good morning, Test Manager" for Groom/Work Rider while the shared
  greeting uses real local time (run17:50). These are not claimed PASS and no
  assertions, clocks or business logic were changed to hide failures. Auth,
  layout, horseApplication, shared controls and unsaved-guard files passed.
- Full lint: FAIL, seven pre-existing errors in three files identical to fetched
  main: `src/app/feature-integration.test.tsx`,
  `src/features/program-creation/ProgramCreationPage.test.tsx` (unnecessary regex
  escapes), and `src/features/rider/lists.tsx` (render-time Date.now).
  These were left unchanged; no lint rule was weakened.
- npm Windows shim could not handle the workspace ampersand. The same installed
  ESLint, TypeScript and Vite CLIs were invoked directly with Node instead.
- Browser: the Leader signed in successfully with the original Club Manager
  account. Refresh restored the session and the real Horse List returned15 rows.
  List and Registration controls/links/fields match the captured main baseline.
  Empty-submit validation, first-invalid focus, filter empty/results states,
  unsaved-change keep/discard and navigation Escape/focus return were verified.
  No valid Horse create/update request was submitted. Screenshots and sanitized
  evidence are in `_gate-monitor/ui-v3-evidence/`: `login-v3-full.png`,
  `horse-list-v3.png`, `horse-registration-v3.png`.
- Environment: original FE checkout now main55f8551, BE checkout main d7fcc3d.
  Their source trees exactly match the previously running candidate trees.
  BE PID9336 and its existing JAR/config remain unchanged; active profile `dev`,
  database `racehorse_integration_test`, strict JDBC TLS unchanged.
  The BE JAR was not rebuilt with an embedded main SHA. Current FE PID24800 runs
  this uncommitted design branch based on55f8551, not an untouched main UI.
  The earlier handoff/demo-runner aliases do not exist in this database; their401
  responses were not evidence that the original account password was wrong.
  Port5210 was also outside the BE CORS allowlist; the review now uses approved5173.
  All7 original role accounts were verified ACTIVE using SELECT only; only Club
  Manager browser login was verified. Passwords were not reset or read during
  recovery. No SQL service/configuration or database records were changed.
- Responsive Login at the actual narrow viewport596x668 has no horizontal
  overflow and retains the photo, text and complete form in the original order.
  Exact390px and controlled desktop viewport checks are NOT VERIFIED: the supported
  viewport override did not match actual innerWidth. Override was reset. Do not
  use the invalid `login-v3-mobile.png` capture as evidence.
- Changes are local and uncommitted on `design/ui-v3`; no push or deployment.

## Resume

## Current delivery batches

1. Shared foundation/layout: implemented document scope, nested v2 token alignment,
   Sidebar/Header, buttons, fields, tables, cards, tabs, charts and overlay states.
   Verification in progress; commit follows checks.
2. Training: pending module CSS review and regression checks.
3. Horse: three approved views implemented; remaining detail/setup/history pending.
4. Medical: pending module CSS review and regression checks.
5. Groom/Rider/Owner: pending module CSS review and regression checks.
6. Administration: pending module CSS review and regression checks.
7. Public/account/shared: Login implemented; remaining states pending.
8. Integration: pending coverage/evidence and final push.

Do not read passwords, reset accounts, invent JWTs or add runtime fixtures. Do not
write business records in the existing DB during verification: the latest directive
preserves existing records. Mutation paths can use HTTP fixtures for regression;
live write persistence remains unverified unless separate authorization is given.
Other six real role sessions remain unavailable until legitimate sign-in. Never
substitute role-test authority for real JWT browser verification.
