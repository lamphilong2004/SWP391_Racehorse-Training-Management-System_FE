# Hoàng FE delivery — 2026-10-19

Feature branch: `feat/hoang-core015-025-fe-ready`, based on FE Integration `9fb747db7f985c7002373099fbae341f40d59e82`.
Contract source: BE dev `9dc594d`, `docs/api/flow3-medical.openapi.yaml`, `flow2-training.openapi.yaml`, `flow1-horse.openapi.yaml`, `flow2-stomp.md`.

## Implemented routes

| CORE | Feature entry | Access | Live dependencies |
| --- | --- | --- | --- |
| 015 | `/horses/:id/baseline`, linked from the Vet horse profile | Veterinarian writes | CORE-014 baseline and weight endpoints; existing horse and activation reads |
| 022 | Existing `/training/programs/new` | Head Trainer | CORE-021 program/template/Trainer APIs; existing creation state machine retained |
| 025 | `/dashboard` for Trainer; `/training/schedule/session/new`; `/training/session/:id` | Trainer creates; existing session readers retained | CORE-024 session, suitability and rider recommendation APIs; CORE-021 assigned programs |
| 020 | `/medical/restrictions`, `?horseId=:id` | Vet editor; HT/Trainer/CM read | CORE-019 availability, restriction list/create/lift and exercise-rule replacement |
| 031 | `/training/monitoring?sessionId=:id` | Trainer/HT/Vet/CM read; Trainer pause/stop; Trainer/Vet acknowledge | CORE-030 session/result REST and `/ws` STOMP, CORE-019 effective threshold read for its permitted roles |

All new runtime requests use the canonical API base, authSession and requestApi. Runtime does not import fixtures, supply fallback records, invent telemetry, calculate severity, derive warning thresholds, or change backend business rules. A failed endpoint remains an error/unavailable state. The existing MODE=test transport branch belongs to the integration baseline; no runtime sample path was added.

## Approved Figma mapping

File: `tm7dpgAQbHReZ7tlQeQJlc`. Design context and screenshots were read before implementation.

- CORE-015: `273:1805` (SCR-MED-006 Initial Health Baseline).
- CORE-022: S1 `84:286`; S2 `87:684`; S3 `87:1188`; S4 `88:286`; S5 `88:764`; S6 `90:415`; S7 `91:299`.
- CORE-025: Dashboard `94:286`; Create S1–4 `101:286`, `103:286`, `107:296`, `108:511`; Detail `147:5976`, `149:6422`, `150:6487`.
- CORE-020: Vet `210:9332`; individual read view `214:9185`; HT list `275:9512`.
- CORE-031: `151:6627`.

Canonical AppShell/components/tokens supply the matching icons, cards, charts, badges and fields. No temporary Figma asset URLs were introduced.

## Contract gaps and deliberate unavailable regions

- Baseline accepts only `weightKg`, `healthStatus`, `clinicalNotes`. Current condition and optional notes are preserved in clinicalNotes. Examination time is server-owned and shown read-only; no unsupported `examinedAt` is sent.
- CORE-022 analytics in Figma (fitness ratings, weekly load points, top-speed trend, strengths/development and latest-session summary) have no corresponding approved profile projections. Their layout regions show unavailable states. Existing leader exclusions of target race/date and phase preferred surface remain in effect. Breed/stable filters remain disabled because the approved horse list only exposes the supported query fields. Availability filtering uses the approved field.
- Session phase and intensity constraints and C/D acknowledgement are checked locally and rechecked by the server. A/B hard blocks cannot be overridden. Session scheduling calls only the approved draft, suitability, rider recommendation and create operations. No source template/program mutation is performed.
- Restriction writes preserve API `ALLOWED`/`PROHIBITED` even though Figma labels permitted work. AVAILABLE is never created: it is derived after an explicit lift. The contract has no in-place reason/level/effective-time edit. Those active fields stay read-only; a different level requires explicit lift then create.
- Restriction creation and exercise-rule replacement are separate approved operations. If rule replacement fails after creation, the UI reports the existing restriction ID and the unconfirmed rules; retry does not insert another restriction.
- Existing LIMITED rules cannot be replaced when both read responses omit the rule set; the editor preserves server rules and requests a reload.
- Restriction list pagination has no horseId filter or get-by-ID operation. The detail adapter pages the permitted list to locate the active restriction. Missing metadata remains unavailable. No clinical case join is exposed to training readers.
- STOMP is subscribe-only. CONNECT carries the JWT; subscriptions use only the three session topics. Unmount unsubscribes/disconnects and heartbeat/connection failures are visible. Reconnect reloads session/result REST before resubscribing. No connection is established before those reads succeed.
- Monitoring uses server classifications and effective threshold values. Missing warning threshold, current exercise/repetition and completion fields are not inferred. The proposed reduce-intensity signature remains unimplemented pending its decision. Simulated data is labelled whenever the server source or simulated flag indicates it. The chart retains the latest 300 received samples.

## Verification and evidence

- Scoped adapter/component/stream tests and route/RBAC regressions are used, rather than the whole FE suite.
- The existing CORE-022 happy path is rerun because its horse-selection UI changed; the historical 128-test suite is not rerun.
- Production build, targeted lint and `git diff --check` are required before push.
- `scripts/check-main-flow-ui.cjs` runs Chrome against a local production preview with test-only HTTP/STOMP interception. It exercises baseline save, all session creation steps, restriction read-only access, monitoring simulation labels and a denied Groom route. It records only synthetic fixture identities.
- Browser evidence: `docs/evidence/hoang-main-flows/`. These screenshots prove rendering and fixture interactions only, not live BE/SQL/STOMP integration.
- No new deployed backend origin or seeded account was supplied in this implementation run. Endpoint bindings are prepared; new live integration is unverified.

Recorded checks: 11 focused adapter/form/stream tests PASS; 32 scoped route/RBAC regression tests PASS; one CORE-022 create/read-back happy path PASS. Production build, targeted ESLint and diff whitespace checks PASS. Chrome production-preview smoke PASS with one baseline POST, one session POST and no page exceptions. Final screenshots were refreshed after the last layout change. These are author checks, not an Independent Gate.

## Ownership and external coordination

Integration coverage matrix currently identifies CORE-041 as Hoàng, CORE-050 as Dũng and CORE-054 as Hoàng. These owner notes are not a new canonical-board verification. GitHub Projects access returned `error: your authentication token is missing required scopes [read:project]`; no Task Playbook file is present in the fetched FE/BE trees. No optional CORE-041/050/054 implementation was added.

Landing `400:6` is approved. The fetched FE branches and GitHub PR list contain no CORE-010/Landing delivery. No accessible chat could be identified as Dũng's Landing task, so direct progress confirmation with him remains outstanding. This branch does not build a duplicate Landing.

## Session checkpoint

Implementation resumed from the user-approved baselines, in a new checkout. Existing checkouts and BE files were preserved. Feature routes are integrated only on this feature branch for PR review. Next external actions are API deployment/account configuration, owner confirmation for optional scope and Landing coordination. Integration merge remains a reviewer action.
