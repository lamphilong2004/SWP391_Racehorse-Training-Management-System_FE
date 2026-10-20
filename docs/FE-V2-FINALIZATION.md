# FE v2 finalization — Leader scope

Branch `feat/long-fe-v2-finalization`, built on FE PR #20 (`feat/long-fe-v2-foundation` @ `69d8972`), which sits directly on `main` @ `bfa8147`. PR #20 and `main` history and authors are preserved. Preview branch `preview/role-test-main` @ `6a1a333` is unchanged.

Design source: `Racehorse_UI_v2_Equestrian_Command.zip` (`Racehorse_Design_System_v2.md`, `Racehorse_UX_Playbook_v2.1.md`, `racehorse-v2.tokens.css`), already encoded in `src/design-system/styles/tokens.css` by PR #20. No new tokens, theme or parallel component set were created. Approved Figma `tm7dpgAQbHReZ7tlQeQJlc` remains the per-screen layout reference; the v2 documents are marked PROPOSED, so this branch is a review candidate, not a Production rollout.

## What changed

| Area | Change | Owner |
|---|---|---|
| Shell | Sidebar + Header always render in the v2 scope (navy 240 / header 64). Page content opts in with `AppShell designSystem="v2"`. Content gutter 24/32/16. Skip link. No `min-width: 1280px`. | Long (shared) |
| Responsive navigation | Below 1024px the sidebar is a drawer opened from a Header menu button (`aria-controls`/`aria-expanded`); Escape and the scrim close it and return focus; route change closes it. Header search/name collapse on narrow web. | Long (shared) |
| Error boundary | `RouteErrorPage` on every top-level route: recoverable chunk-load and render failures, no stack/asset/request text. | Long (shared) |
| Guard | `UnsavedChangesGuard allowSameRoute` for screens that keep query views mounted. `focusFirstInvalid` utility. | Long (shared) |
| v2 scope fix | `:where([data-design-system='v2'])` so the scope background never overrides component surfaces (the production bundle showed the sidebar on the page colour). | Long (shared) |
| CORE-013 | Register Horse, Pedigree & Ownership, Pending Activation in v2; dirty guards released only after server confirmation; first-invalid focus; layout stacks below 1024/768. | Long |
| CORE-027 | Groom Today, Pre-session Check in v2; dirty guard; focus first unanswered check; 44px targets; segmented control under its label on narrow web. | Long |
| CORE-029 | Work Rider screens in v2; Report Issue / Add sample not dismissible while typed; feedback guard; bottom action bar at 375; tables in labelled scroll regions; 2-column metrics; no overflow (was 615px wide at 375). | Long |
| CORE-033 | Session Evaluation and Performance in v2; evaluation draft survives Performance History; first-invalid focus; performance client rejects non-list bodies (crash fixed). | Long |
| CORE-044 | Assigned Programs, Calendar, Exercise Library in v2; toolbar wraps below 1280 (was 212px overflow at 1024); Exercise builder not dismissible while typed. | Long |

Hoang's and Duc's screens keep their v1 content inside the v2 shell. Shared horse CSS (`horses.module.css`, also used by Duc's Horse List/Profile) received layout-only responsive rules; no fields, actions or data changed.

## Screen coverage (screens/dialogs/states, not routes)

Status: DONE = UI and behaviour present with automated tests, verified with fixtures only. PARTIAL = present with a concrete gap. MISSING = no business UI (guarded unavailable route at most). BLOCKED_CONTRACT = field/operation not in the approved API. No item is live-Backend verified.

### Flow 1 — Horse

| Screen | Figma | Route | Owner | Status | v2 |
|---|---|---|---|---|---|
| Register Horse | 282:2377 | `/horses/new` | Long 013 | DONE | Yes |
| Pedigree & Ownership | 283:2487 | `/horses/:id/edit` | Long 013 | DONE (pedigree note BLOCKED_CONTRACT) | Yes |
| Assign Stable Box | 284:2588 | modal | Long 013 | DONE | Yes |
| Pending Activation | 285:2786 | `/horses/pending-activation` | Long 013 | DONE | Yes |
| Horse List / Profile / History / Readiness | 281:2158, 200:8678, 200:8809 | `/horses`, `/horses/:id` | Duc 017 | DONE (v1) — narrow-web touch targets PARTIAL | Shell only |
| Vet baseline | 273:1805 | `/horses/:id/baseline` | Hoang 015 | DONE (v1) | Shell only |

### Flow 2 — Training

| Screen | Figma | Route | Owner | Status | v2 |
|---|---|---|---|---|---|
| Groom Today / Pre-session Check / incident entry | 244:556, 248:667, 253:980 | `/groom/today`, `/training/my-sessions/:id/pre-check` | Long 027 | DONE | Yes |
| Work Rider Dashboard, Assignments, Detail, Start, Active (in progress/paused/interrupted), Report Issue, Add sample, Feedback, History | 416:9660 … 432:17289 | `/rider/*` | Long 029 | DONE (rep progression BLOCKED_CONTRACT) | Yes |
| Session Evaluation (Result, Planned vs Actual, Evaluation) | 161:7413, 164:7560, 165:7664 | `/training/sessions/:id/evaluation` | Long 033 | DONE | Yes |
| Performance History | 166:7791 | `/training/performance` | Long 033 | DONE (top speed/recovery BLOCKED_CONTRACT) | Yes |
| Assigned Programs / Calendar / Exercise Library + drawer + builder | 95:400, 97:286, 105:286, 106:301, 106:387 | `/training/*` | Long 044 | DONE (goal/progress BLOCKED_CONTRACT) | Yes |
| HT Program List | 77:317 | `/training/programs` | Hoang 022 | MISSING | — |
| Create Program wizard | 84:286 … 91:299 | `/training/programs/new` | Hoang 022 | PARTIAL; overflows below 1280 | Shell only |
| Template Library / detail / create-edit-version / Program detail-progress-history / adjustment | 120:5086, 124:5277 …, 78:288 …, 80:778 … | `/training/templates*`, `/training/programs/:id` | Hoang 041 | MISSING | — |
| Trainer Dashboard / Create Session / Session Detail | 94:286, 101:286 …, 147:5976 | `/dashboard`, `/training/schedule/session/new`, `/training/session/:id` | Hoang 025 | DONE (v1); dashboard overflows at 375 | Shell only |
| Live Monitoring — Resume, Alert Detail | 151:6627, 155:7089, 156:7383 | `/training/monitoring` | Hoang 031 | PARTIAL | Shell only |

### Flow 3 — Medical

| Screen | Figma | Route | Owner | Status | v2 |
|---|---|---|---|---|---|
| Herd Health, Cases, Case Detail, Treatment Plan, HT Medical Summary | 267:1223, 270:1588, 274:9405 | `/medical/*` | Duc 036/046 | DONE (v1) | Shell only |
| Injury 3D | 210:9145 | case Injury tab | Duc 036 | PARTIAL (2D fallback) | Shell only |
| Care Tasks / Incidents | 252:843, 256:1015, 257:1112 | `/care/tasks`, `/incidents` | Duc 046 | DONE (v1); Incidents overflows ≤1024 | Shell only |
| Restrictions | 210:9332, 275:9512 | `/medical/restrictions` | Hoang 020 | DONE (v1) | Shell only |
| Threshold override | 272:1791 | dialog | Hoang 020 | MISSING | — |

### Shared

| Screen | Figma | Route | Owner | Status |
|---|---|---|---|---|
| AppShell, navigation drawer, route error boundary, unavailable state | 74:110, 74:367 | all | Long | DONE (v2) |
| Landing, Login | 400:6, 400:7 | `/`, `/login` | Long / Hoang 008 | DONE |
| Owner portal | 299:4305 … | `/owner/horses` | Duc 056 | DONE (v1) |
| CM dashboard / Audit log | 308:4605, 308:5271 | `/dashboard`, `/admin/audit-log` | 052 | DONE (v1) |
| Explicit `/403` / public not-found | 293:3710 | — | Hoang 008 | PARTIAL |
| Notifications drawer + center | 321:5356, 322:5410 | `/notifications` | Hoang 054 | MISSING |
| Staff & Users, Roles & Permissions, full My Account, Forgot/Reset | 288:3192 …, 290:3537, 292:3637, 291:3630 | `/admin/*`, `/account` | CORE-050 — unassigned FE owner | MISSING / PARTIAL |

Leader scope (Long): 25 screens/dialogs across CORE-013/027/029/033/044 plus the shared shell — all DONE with fixtures, in v2. Remaining MISSING/PARTIAL items belong to Hoang, Duc or the unassigned CORE-050 and were not taken over.

## Owner hand-off (compatibility found in the v2 shell sweep)

- Hoang: Create Program wizard overflows by 165–566px below 1280; Trainer Dashboard overflows at 375 and has 20px links; Live Monitoring 20px link; v2 content adoption; the missing screens listed above.
- Duc: Incidents overflows by 58px at 1024/768 and 459px at 375; Care Tasks filter buttons 34px; Horse List/Medical text links 20px on narrow web; Injury 3D; v2 content adoption.
- CM dashboard (052): 20–40px links on narrow web.
- Decision (Long): `/dashboard` for Work Rider, Groom and Horse Owner still shows the generic workspace instead of the existing landings (`/rider`, `/groom/today`, `/owner/horses`). Redirecting changes Hoang's CORE-008 auth tests and Duc's cross-role flow test, so it was not applied here.

## API readiness

Live API calls go through the canonical `requestApi`/`AuthProvider`/JWT client. No fixtures or sample adapters are in the production bundle (`check-production-bundle.mjs`). BE `dev` @ `5867f07` implements only auth (login/me/logout), Horse create/list/detail and stable-box list. Every other endpoint used by the Leader screens (pedigree, ownership, stable assignment, activation, training programs/sessions, groom sessions, pre-session check, rider assignments/history/actions, evaluation, performance, exercises) is contract-only: **WAITING_BACKEND**. No live REST, STOMP or SQL test was run in this branch; CORS for any Preview origin needs Leader approval on the Backend.

## Verification (this branch)

- `npm ci`, ESLint, `tsc -b --noEmit`, full Vitest, `node --test scripts/design-system-policy.check.mjs`, `node --test scripts/staging-policy.check.mjs`, `vite build` + `check-production-bundle.mjs`: see the PR for the exact head results.
- Fixture browser sweep (Chromium iframes, production bundle, local fixture API only): Leader routes × 1440/1280/1024/768/375 — no crash, no main/document overflow, no narrow-web target below 44px outside labelled table regions, all in v2 scope.
- Playwright (`docs/evidence/v2-finalization/a11y-report.json`): skip link, focus outline, navy sidebar colours, keyboard drawer open/Escape/focus return, no overflow at 375, reduced motion, 200% zoom equivalent — 9/9 PASS.
- Before/after screenshots (`docs/evidence/v2-finalization/`): `before-*` from `main` @ `bfa8147`, `after-*` from this branch, at 1440×900 and 375×812, fixture API.

Not established: WCAG conformance of every screen, screen-reader testing, Figma v2 approval, live Backend/SQL integration, Production deployment.
