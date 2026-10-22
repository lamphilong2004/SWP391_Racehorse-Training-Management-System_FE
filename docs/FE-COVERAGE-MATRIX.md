# FE coverage matrix — 3 core flows × 7 roles

20 October final handoff: Hoàng's `a46f80d` delivery and CORE-010 Landing are already in main `bfa8147` via PR #18. `fix/hoang-fe-final-readiness` adds Program List, Leader-approved read-only Program Detail/Progress/History, Alert Detail and Vet Threshold Override, plus restriction/Groom-check/monitoring fixes. CORE-041 expanded management remains after the minimum detail; CORE-050/054 are not expanded. This older matrix also contains historical teammate rows; use [final readiness](HOANG-FE-FINAL-READINESS.md) for current status/API inventory. No live API PASS is claimed.

2026-10-19 delivery overlay: `feat/hoang-core015-025-fe-ready` from Integration `9fb747d`, BE contracts `9dc594d`. CORE-015/020/025/031 now mount feature pages; CORE-022 selection/profile/workload layout is updated. API-only runtime is preserved. See [Hoàng delivery and contract gaps](HOANG-FE-DELIVERY.md). No new live API, Independent Gate or CORE Done claim is made.

Branch `integration/fe-product-main`. Recovered baseline `9b53941` (2026-10-17). This is a coverage report, not a replacement for Project Tracking.

Sources:
- Screen Registry (tracker) and Task Playbook, from the primary workbook `project-context/Racehorse_Core_Flow_Execution.xlsx`
- live Figma `tm7dpgAQbHReZ7tlQeQJlc`
- BE contracts on dev `8b2e22a`
- the actual router and navigation

Legend:
- **UI**: UI Implemented (built, not CORE Done) · PARTIAL · MISSING · DEFERRED (optional module only)
- **Sample**: whether the shared sample adapter (`racehorse.business-samples.v1`) serves it
- **API**: typed HTTP mapping is separate from runtime verification. Auth uses the canonical real client in normal mode; no live Backend/SQL verification was performed in this resume. Contracts on BE dev do not establish implemented REST endpoints.
- **Gate**: no new Independent Gate PASS or CORE Done is established by this document. Tracker status remains unchanged; sample evidence is not production evidence.

## Flow 1 — Horse Management

| Screen | Figma | Route | CORE / owner | UI | Sample | API | Blocking dependency |
|---|---|---|---|---|---|---|---|
| Horse register (list) | 281:2158 · 200:8614 | `/horses` | 017 Đức (provisional integration reuse) | PARTIAL | Yes | Contract in PR #9, separate from runtime | CORE-004 contract; CORE-017 owner review |
| Horse profile | 200:8678 | `/horses/:id` | 017 Đức | PARTIAL (no timeline tab) | Yes | PR #9 | CORE-017 owner |
| Register horse | 282:2377 | `/horses/new` | 013 Long | UI Implemented | Yes | PR #9 | CORE-004 |
| Pedigree & ownership | 283:2487 | `/horses/:id/edit` | 013 Long | UI Implemented | Yes | PR #9 | CORE-004 |
| Stable assignment | 284:2588 | modal in `/horses/:id/edit` | 013 Long | UI Implemented | Yes | PR #9 | CORE-004 |
| Pending activation | 285:2786 | `/horses/pending-activation` | 013 Long | UI Implemented | Yes | PR #9 | CORE-004 |
| Vet baseline + weight | 273:1805 | `/horses/:id/baseline` | 015 Hoàng | UI Implemented | Test fixtures only | CORE-014 typed baseline/weight client | Live API pending; server owns examination time |
| Horse history / timeline | 200:8809 | — | 017 Đức | **MISSING** | No | PR #9 | Owner |
| HT readiness review | profile context | — | 017 Đức | **MISSING** | No | PR #9 | Owner |

## Flow 2 — Training Management

| Screen | Figma | Route | CORE / owner | UI | Sample | API | Blocking dependency |
|---|---|---|---|---|---|---|---|
| Horse Training Programs (HT landing) | 77:317 | `/training/programs` | 022 Hoàng | List, status filter and paging implemented in local final-readiness branch | Test fixtures only | Canonical JWT client, CORE-021 list | Live API pending; summary/goal/progress unavailable |
| Create program wizard | 84:286 … 91:299 | `/training/programs/new` | 022 Hoàng | Existing flow reused; horse table/profile/workload layout updated | Test fixtures only | CORE-021 contract | Analytics projections and breed/stable filters unavailable; live API pending |
| Program detail / progress / history | 78:288 · 79:288 · 80:423 | `/training/programs/:id` | CORE-041 Hoàng, approved minimum read-only | Implemented; role-limited tabs and existing list/assigned navigation | Test fixtures only | CORE-021 detail/progress/history | Live Backend pending; unsupported analytics unavailable |
| Template library | Page 03 C1 | `/training/templates` | 041 Hoàng | **MISSING** (guarded unavailable state) | 1 template | Contract | Owner handoff |
| Trainer dashboard | 94:286 | `/dashboard` (TRAINER) | 025 Hoàng | UI Implemented | Test fixtures only | Assigned program/session reads; evaluation readiness from session detail | Live CORE-021/024 API pending |
| Create session / session detail | 101:286 … 108:511 · 147:5976 | `/training/schedule/session/new`, `/training/session/:id` | 025 Hoàng | Four-step wizard and state-specific detail mounted | Test fixtures only | CORE-024 draft/suitability/rider/create/read adapter | Live API pending; server validates hard blocks |
| Assigned programs | 95:400 | `/training/programs/assigned` | 044 Long | UI Implemented; goals/progress absent from list contract | Yes | Contract | Full DoD/Gate pending |
| Training calendar | 97:286 | `/training/calendar`, `/training/schedule` | 044 Long | UI Implemented; crowded days scroll | Yes | Contract | CORE-025 handoff; Gate pending |
| Exercise library / drawer / builder | 105:286 · 106:301 · 106:387 | `/training/exercises` | 044 Long | UI Implemented; unsupported definition fields unavailable | Yes | Contract | BLOCKED_CONTRACT for full Figma fields |
| Live monitoring (Trainer) / realtime (HT) | 151:6627 | `/training/monitoring?sessionId=:id` | 031 Hoàng | Metrics/chart/alerts and reconnect states mounted | Test fixtures only; no fabricated runtime telemetry | CORE-030 REST + subscribe-only STOMP; CORE-019 thresholds | Live transport pending; warning/progress fields remain unavailable |
| Performance | 166:7791 | `/training/performance?horseId=:id` | 033 Long (Leader exception) | UI Implemented: horse-scoped entry reusing history; full charts remain partial | Shared graph | Approved program/performance HTTP mapping | Top-speed/recovery and richer filters absent from contract; no invented values |
| Groom today + pre-check + incident | 244:556 · 253:980 | `/groom/today`, `/training/my-sessions/:id/pre-check` | 027 Long | UI Implemented | Yes | Contract | CORE-026 assignment model / CORE-046 shared modal |
| Work Rider dashboard / assignments / start / active / feedback / history | 416:9660 … 432:17289 | `/rider/*`, `/training/rides/*` | 029 Long | UI Implemented (Claude's WR-D4/D5/D6 work preserved) | Yes | Contract | Realtime CORE-054/030; Gate pending |
| Session result / evaluation / history | Page 03 C2 | `/training/sessions/:id/evaluation` | 033 Long (Leader exception) | UI Implemented | Yes | Contract | Historical324d511 preserved; no new Gate PASS |

## Flow 3 — Medical / Health Management

| Screen | Figma | Route | CORE / owner | UI | Sample | API | Blocking dependency |
|---|---|---|---|---|---|---|---|
| Herd health | 267:1223 | `/medical/herd-health` | 036 Đức | UI Implemented | Yes | Flow 3 contract; runtime unverified | CORE-036 owner/Gate |
| Medical cases / case detail / exam / injury / re-exam / close | Page 04 medical | `/medical`, `/medical/cases/*` | 036 Đức | PARTIAL: 2D injury path; 3D/HT variants still missing | Yes | Contract | CORE-036 owner/Gate |
| Treatment plan | 270:1588 | `/medical/cases/:id/treatment-plan` | 046 Đức | UI Implemented | Yes | Contract; runtime unverified | CORE-046 owner/Gate |
| Incident list / detail / review | 256:1015 · 257:1112 | `/incidents`, `/incidents/:id` | 036 / 046 Đức | UI Implemented | Yes | Contract | Shared Rider/Groom modal DoD remains incomplete |
| Groom treatment tasks | 252:843 | `/medical/my-tasks` | 046 Đức | UI Implemented | Yes | Contract | CORE-046 owner/Gate |
| Restriction editor (Vet) / status (HT, Trainer) | 210:9332 · 214:9185 · 275:9512 | `/medical/restrictions`, `?horseId=:id` | 020 Hoàng | Editor, list and read-only reason mounted | Test fixtures only | CORE-019 create/rule replacement/lift/read adapters; ALLOWED/PROHIBITED retained | Live API pending; active reason/level has no update operation |
| HT medical summary | 274:9405 | `/medical/summary` | 036 Đức | **MISSING** (guarded unavailable state) | Partial (cases) | Contract | CORE-036 owner handoff |

## Shared / role landing

| Screen | Figma | Route | CORE / owner | UI | Note |
|---|---|---|---|---|---|
| Login | 400:7 | `/login` | 008 Hoàng | UI Implemented | Normal mode uses real auth; presentation identity is development-only. Registration copy needs owner alignment with DEC-008 |
| Role landing redirect | registry | `/dashboard` | 008 Hoàng (follow-up) | PARTIAL | Generic workspace for HT/Vet/Trainer |
| CM dashboard + audit log | 308:4605 · 308:5271 | `/dashboard`, `/admin/audit-log` | 052 Dũng in primary tracker; Đức remediation per Leader | Integrated from786d397; Gate Pending | Canonical client; explicit shared-sample projections; no live BE/SQL claim. Users/Registrations remain unavailable; Reports deferred. F5 management path exception pending formal approval |
| Staff & Users / Roles | 288:3192 … 290:3537 | `/admin/users`, `/admin/roles` | 050 Dũng (primary tracker) | **MISSING** (guarded unavailable state) | Required shared infrastructure; owner handoff |
| Owner My Horses | 299:4305 | `/my-horses`, legacy `/owner/horses` | 056 Đức | **MISSING** (guarded unavailable state) | Mandatory minimum workspace under DEC-009; only race/finance/video remain deferred |
| Notifications | 321:5356 · 322:5410 | `/notifications` | 054 Hoàng | **MISSING** (guarded unavailable state for all 7 roles) | Header bell navigates here; no fake count/list/mark-read |

## Dead navigation found at the baseline

These sidebar destinations were unregistered at recovered baseline9b53941:
- HT: Programs, Templates, Performance, Realtime, Medical Summary, Restrictions
- Trainer: Live Monitoring, Performance, Restrictions
- CM: Staff & Users, Roles, Audit Log
- Owner: My Horses, Notifications

The recovered interrupted route patch replaces known missing screens with explicit unavailable states, preserving their owner and Gate. Performance now opens the existing CORE-033 history through a real route. CORE-052 integration replaces only the Audit unavailable entry and the CM dashboard, preserving six other role workspaces. Unknown URLs still use the actual404. Unavailable pages are not completed business modules, Sample E2E PASS, or CORE Done.
