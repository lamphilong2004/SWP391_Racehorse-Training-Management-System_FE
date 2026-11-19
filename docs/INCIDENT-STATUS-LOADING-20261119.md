# CORE-036 — Incident horse status loading/retry

Refs #52. Base: FE main `c211075c9ce12e4207d4d68d08b70e72c770b512`.

## Problem and behavior

On `/incidents/:id`, the horse-status card displayed “Không tải được tình trạng ngựa.” while its read was still pending. A slow successful read therefore looked like a failure, and an actual failure had no retry action.

Use the existing shared LoadingState while pending; show shared ErrorState with retry only after failure. Retry reads the same approved HorseReader. Health, training availability, incident state, API DTOs, JWT/RBAC and browser storage are unchanged. No theme/component library added.

## Validation

- Two new regressions fail on the old source: missing loading feedback and missing retry.
- `Incidents.test.tsx` + `horseRead.test.tsx`: **29/29 PASS**.
- Targeted ESLint, TypeScript/production build, `PRODUCTION_BUNDLE_OK`, staging policy **13/13**, diff check: PASS.
- Chrome: delayed GET → loading without false error → actual response; controlled HTTP 500 → retry → actual GET recovery: PASS. Zero business writes.
- Browser delay/error is a controlled fixture, not proof of SQL writes. Ultimate successful reads use local BE main `ee7fde6`; account Groom, QA horse 7, incident 12 on `racehorse_local_duc_20261111`.
- Existing unrelated build warning: AppShell CSS `@reference` is reported by minifier; production build still succeeds. No shared AppShell edits in this PR.

## Before / after

- [Before: pending mislabeled as failure](evidence/issue-52-incident-loading/before.png) — reproduced on main with GET held pending.
- [After: loading](evidence/issue-52-incident-loading/loading.png).
- [After: failure + retry](evidence/issue-52-incident-loading/retry.png).
- [After: recovered](evidence/issue-52-incident-loading/recovered.png).

## Manual check

1. Sign in as Groom and open an owned incident; throttle the horse-status GET.
2. Card says “Đang tải tình trạng ngựa…” until response; it must not declare failure during pending.
3. Fail that read once, then allow the next read. Select “Thử lại”; health/availability appear and the incident stays visible.

Separate real API/SQL medical + care/inventory evidence is in PR #63. This PR fixes only the small read-feedback bug found during that smoke. Independent review required; author has not approved or merged.
