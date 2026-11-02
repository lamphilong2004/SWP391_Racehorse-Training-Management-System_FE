# Form shortcuts — 2026-11-02

Implemented in the existing local FE worktree, preserving prior WIP. No Backend, schema, business validation, auth/RBAC or main history changed. No commit/push/merge/deployment in this batch.

| Screen | Improved input | Behavior |
|---|---|---|
| Horse identity | Country of origin | Common-country dropdown plus custom text; unknown saved values retained exactly |
| Horse identity | Existing breed/sex dropdowns | Shorter placeholders fit the three-column form; custom alternatives unchanged |
| Pedigree | Sire / dam | Search real GET /api/horses by name/code, server paging, explicit ID selection and a manual alternative for external horses |
| Staff create/edit | Experience description | Suggested descriptions plus custom text; never calculated from years or presented as a formal qualification |
| Care plans | Time slot | Common times selectable; custom slot labels remain valid |
| Nutrition plans | Meal/time | Common times selectable; no automatic ration, schedule or quantity change |
| Nutrition plans | Unit | Common unit suggestions plus custom text; changing the unit does not convert quantity |
| Inventory create/edit | Unit | Same shared selector and manual alternative |
| Medical case create | Horse identity | Search/select real horse by name and code instead of typing a numeric ID; preserve reason and selection on errors |
| Training session create/edit | Session and exercise surfaces | Turf/dirt/synthetic suggestions plus existing/custom surface text; no change to suitability checks or units |

## UX and data boundaries

- One shared PresetField composes canonical SelectField/TextField, supports keyboard/native select behavior, explicit labels, required/disabled/error states and existing length limits. Opening custom input retains current text. Presets are optional shortcuts, not a new closed vocabulary or validation policy.
- Parent records are distinguished by ID and horse code, including duplicate names. Current horse excluded. Nothing is selected automatically; pagination totals are server totals and the excluded-current-horse scope is explained. Network errors offer retry, no fixtures. Request counters and mounted guards ignore stale/closed-picker responses. Manual edits clear the explicit new record selection; existing unchanged references remain preserved.
- The same HorseRecordPicker is reused for Medical instead of a second lookup implementation. Vet search uses the existing authenticated GET /api/horses with server query/pagination; there is no new endpoint or ACTIVE-only filter that would exclude a valid existing DRAFT horse. Case creation still sends exactly horseId/reason and the Backend decides eligibility. A blank selection cannot submit. No clinical finding, reason or horse identity is invented.
- Ownership percentages, identity facts, clinical decisions, schedules, quantities, medication details and free-text reasons remain user decisions. No automatic 100% ownership, stable allocation, clinical defaults or phantom successful save.
- Staff experience and units retain legacy/custom values. Existing dirty guards and failed-save preservation stay in place. Care/nutrition rows now align fields from the top so multiline helper text does not stagger controls.
- Horse business-code generation is NOT implemented in this FE-only batch. The current Backend still requires horseCode. A real sequential allocator needs a separate compatible Backend change and concurrency tests; the FE does not fabricate a next number from the loaded list.

## Evidence

- 87 affected tests PASS across shared preset control, parent picker, Horse app/flow, Flow4 and staff forms. After the final picker lifecycle correction, its 5 tests were rerun and PASS. Tests cover custom values, duplicate names/explicit parent payload, server pagination, stale/unmounted responses, failed saves, unchanged quantity and staff legacy descriptions. These are fixtures, not fresh SQL E2E writes.
- The extension suite adds Medical lookup/form and Training create/edit coverage: 66/66 PASS. This overlaps the earlier 87-test set; do not sum these as unique tests. Verified actual selected horseId, unchanged request DTO, no POST without selection, network errors, draft retention, chosen surface in the create payload, legacy custom surface preservation, unchanged Rider and medical hard-block checks.
- TypeScript, full ESLint, production Vite build, production bundle guard and diff checks PASS. React lint initially found effect/render ref misuse in the new picker; fixed without disabling lint rules.
- Final real local browser: 12 Club Manager checks/27 API requests plus 8 Vet/Trainer checks/10 API requests. Zero page errors/failed API responses; country/custom, real parent search/selection, staff description, care time, meal/unit, inventory unit, Medical horse lookup/reason preservation and Training surface/custom input. Horse/nutrition/Medical/Trainer forms checked at 1440/1024/390 widths with no document overflow. All forms intentionally unsaved: zero business mutation requests, no new SQL scenario records. Auth login may update its normal audit/timestamp.
- Browser audit initially waited for a native option to be visible; corrected to wait for DOM attachment before selectOption. No application behavior or assertion weakened.
- Private evidence/screenshots: `.preview-local/racehorse-training/form-shortcuts-*`. Temporary browser closed; existing local FE5214 retained, BE8080 and SQL untouched.
