# UI Coverage Matrix — 3 Main Flows (UI-first / API-later)

Checked 2026-10-17 on branch `feat/dev-ui-harness` (base: integration branch `feat/long-core013-027-029-ui` @ `8c19ac0`).
Sources: tracker Screen Registry + Task Playbook, live Figma `tm7dpgAQbHReZ7tlQeQJlc`, BE contracts on dev `8b2e22a`.

Status legend:
- **RUNS (sample)**: screen exists and was operated end to end in the browser with the sample adapter. This is **not** FE-BE integration.
- **PARTIAL**: exists, but there is a known gap (listed).
- **MISSING**: no screen yet; owner shown.

All "RUNS" entries are fixture/sample evidence only. Real API wiring is Phase 3 and needs the BE tasks.

## How to run (development harness)

```bash
npm run dev:present        # presentation view on http://localhost:5190 (official Login, no dev toolbar)
npm run dev:harness        # developer view on http://localhost:5192 (yellow DEV HARNESS bar)
```

- Presentation view: sign in on the official Login page with the local presentation accounts listed in docs/PRESENTATION-GUIDE.md.
- Developer view: pick a role in the yellow **DEV HARNESS — SAMPLE DATA** bar at the bottom. There are 7 roles, the identity is simulated and no JWT is issued.
- In harness mode every `/api/**` call is answered by the browser-local sample adapter (`src/shared/data/*`). No backend is called.
- Reset: dev bar **Reset sample data**, or http://localhost:5190/presenter-tools (dev only, not in navigation). Both affect only the browser sample store.
- Harness code is dev-only. `npm run build` output contains none of it.

## Flow 1 — Horse Management

| Screen | Figma | CORE / Owner | Status |
|---|---|---|---|
| Horse register (list, filters) | Page 04 horse list | CORE-017 / Đức (implementation present in `features/horses/HorsePages.tsx`, see handover) | RUNS (sample) — handover to Đức |
| Horse profile | Page 04 profile | CORE-017 / Đức (same file) | PARTIAL: no timeline/history tab, no HT readiness action |
| Register horse — identity + photo | 282:2377 | CORE-013 / Long | RUNS (sample) |
| Pedigree & ownership | 283:2487 | CORE-013 / Long | RUNS (sample) |
| Stable assignment (free box) | 284:2588 | CORE-013 / Long | RUNS (sample) |
| Pending activation + checklist (no approve button, DEC-009 §1) | 285:2786 | CORE-013 / Long | RUNS (sample); "Request baseline examination" disabled (no approved operation) |
| Vet baseline examination + weight/health | Page 04 mapped frames | CORE-015 / Hoàng | **MISSING** (sample adapter already answers the CORE-006 contract `POST /api/horses/{id}/baseline-examinations`) |
| Horse lifecycle history / timeline | Page 04 history | CORE-017 / Đức | **MISSING** |
| HT readiness review (non-blocking) | profile context | CORE-017 / Đức | **MISSING** |

## Flow 2 — Training Management

| Screen | Figma | CORE / Owner | Status |
|---|---|---|---|
| Create training program wizard (7 steps, template, Trainer) | 77:317 family | CORE-022 / Hoàng | RUNS (sample) |
| Horse Training Programs list (HT landing) | 77:317 | CORE-022 / Hoàng | **MISSING** (route `/training/programs` not registered) |
| Template Library, Program Detail / Progress / History, Program Adjustment | Page 03 C1 | CORE-041 / Hoàng | **MISSING** |
| Trainer Dashboard | 94:286 | CORE-025 / Hoàng | **MISSING** (generic workspace only) |
| Create Session / Session Detail states | Page 04 mapped | CORE-025 / Hoàng | **MISSING** (sample sessions are pre-seeded) |
| Assigned Programs, Calendar, Exercise Library | Page 03 C2 | CORE-044 / Hoàng | **MISSING** |
| Trainer Live Monitoring (pause/resume/stop, alerts) | Page 03 C2 | CORE-031 / Hoàng | **MISSING** (STOMP needs BE CORE-030) |
| Groom Today | 244:556 | CORE-027 / Long | RUNS (sample) |
| Pre-session check 5 items + explicit incident report | 253:980 / 248:667 / 250:756 | CORE-027 / Long | RUNS (sample): normal and abnormal paths |
| Work Rider dashboard | 416:9660 | CORE-029 / Long | RUNS (sample) |
| My Riding Assignments | 426:10287 | CORE-029 / Long | RUNS (sample) — matched to Figma on this branch |
| Assignment detail + start confirmations | 416:9756 / 430:10683 | CORE-029 / Long | RUNS (sample) |
| Active session, manual sample, finish | 416:9837 | CORE-029 / Long | RUNS (sample); REST polling only, no WebSocket |
| Paused (by Trainer) / Interrupted | 425:10068 / 425:10430 / 429:10577 | CORE-029 / Long | RUNS (sample) |
| Rider feedback | 432:10702 | CORE-029 / Long | RUNS (sample) |
| My Riding History | 427:10371 | CORE-029 / Long | RUNS (sample) — matched to Figma on this branch |
| Report issue modal (WR) | 431:10696 | CORE-046 / Đức | RUNS (sample) |
| Session result, Planned vs Actual, evaluation, performance history | Page 03 C2 | CORE-033 / Long | RUNS (sample) |

## Flow 3 — Medical Management

| Screen | Figma | CORE / Owner | Status |
|---|---|---|---|
| Incident list / detail + review (open/link case, resolve) | 256:1015 / 257:1112 | CORE-036 / Đức | RUNS (sample); shows raw horse/reporter IDs |
| Medical case: examination, injury + body map, re-examination, close | Page 04 medical | CORE-036 / Đức | RUNS (sample); body-map selection does not prefill the injury form |
| Treatment plan + Groom tasks | 270:1588 | CORE-036 / Đức | RUNS (sample); Groom chosen by numeric user ID |
| Herd health | 267:1223 | CORE-036 / Đức | RUNS (sample) |
| Groom treatment tasks (complete) | 252:843 | CORE-046 / Đức | RUNS (sample) |
| Groom incidents + IncidentReportModal | 253:980 | CORE-046 / Đức | RUNS (sample) |
| Restriction editor (Vet) / read-only status (HT, Trainer) / HT medical summary | 275:9512 / 274:9405 | CORE-020 / Hoàng | **MISSING** |

## Cross-cutting gaps (owner to confirm)

1. CORE-008 (Hoàng, merged with gaps):
   - no role guard / 403 route
   - `/dashboard` does not redirect each role to its registry landing
   - unknown public paths go to login instead of the public 404
2. Design system (CORE-002, Hoàng): Figma "Filter tabs" (segmented pill, e.g. 426:10370) has no design-system variant. Screens currently use the underline `Tabs`.
3. Sample adapter: by design it does not compute server aggregates (max/avg HR, speed, duration, distance), so Planned vs Actual shows "Not measured" for those until the BE computes them.

## 3-flow click script (harness, from a fresh reset)

1. **Club Manager**: Register horse → name `Silver Arrow`, ID `RH-021`, DOB, sex, breed → *Save Draft & Continue* → sire/dam → owner `Horse Owner · Sample`, share, date → *Assign Stable Box* `B-07` → *Save & Continue*. Pending Activation now shows 3/4 mandatory items complete, waiting for the Vet baseline.
2. **Head Trainer**: *Create program* → Thunder Bolt → recommended template → dates → intensity LOW–MEDIUM → Trainer → *Create and activate program*.
3. **Groom**: Today → session SES-0044 → five *Normal* → *Complete Pre-Session Check*. Then SES-0045 → *Legs & hooves: Abnormal* → *Report Incident* (records the check) → *Report Incident* → type/severity/description → *Submit Incident*.
4. **Work Rider**: My Rides → SES-0044 *View Assignment* → *Ready to Start* → tick 6 confirmations → *Start Session* → *Add sample* (HR, speed, distance) → *Finish Session* → feedback → *Submit Feedback*. Then SES-0047 → *Report Issue* → INTERRUPTED.
5. **Trainer**: dev bar *Session results* → SES-0044 → Result / Planned vs Actual → *Evaluation & Recommendation* → *Met target* + notes → *Save Evaluation*.
6. **Veterinarian**: Incidents → INC from step 3 → *Open medical case* → Examination (injured) → Injury (Left Forelimb) → Treatment plan with Groom task (Groom 16) → save.
7. **Groom**: Treatment tasks → *Mark complete*.
8. **Veterinarian**: case → Re-examination *RECOVERED*, health FIT → Incidents → *Resolve incident* → case → *Close case* → *Confirm close*.

The Vet baseline (CORE-015), program list/detail (CORE-022/041), Trainer scheduling and live monitoring (CORE-025/031) and restrictions (CORE-020) are not yet available. Say so explicitly when presenting.
