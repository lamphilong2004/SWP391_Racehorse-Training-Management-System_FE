# Role-based UI/UX refinement — 2026-11-02

Scope: improve the existing FE across all seven roles after Long's screenshot and request. Existing local WIP preserved in feat/flow4-local-review. No Backend, API contract, JWT/RBAC, schema, clinical state, database business record or cloud configuration changes. Source remains local; no commit/push/main merge.

## Changes by area

| Area / role | Observed issue | Implemented change |
|---|---|---|
| Club Manager: horse strengths | Similar small pills did not explain multi-select, selected count or unknown assessment; groups lacked boundaries | Four bordered groups, checkbox-like 44px choices, visible non-color check indicator, concise guidance, live selected count and explicit clear-all. Native checkboxes/Space support and original strength codes retained |
| Head Trainer: template library | Long names repeated in action buttons; card actions landed at inconsistent heights | Compact “Xem chi tiết” with original full accessible name, cards stretch consistently and actions sit at the bottom; no template/API changes |
| Groom: Today | Date input expanded to the whole content width and Today wrapped unnecessarily | Compact framed date toolbar, bounded date control, aligned Today action, wrapping at narrow widths; timezone/date requests unchanged |
| Horse Owner: horse list | Variable card content left actions at different heights; long names could strain card headings | Equal-height rows, action anchored at bottom, wrapping long names. Profile/Health/Training and clinical visibility boundaries unchanged |
| Horse Owner: lifecycle vs availability | DRAFT plus AVAILABLE looked like operational readiness | List and Health explain that DRAFT/INACTIVE is not an operational horse. Stored availability remains a separate fact; LIMITED/LOCKED warning badges remain visible. ACTIVE/unknown lifecycle wording is preserved. No data or authorization change |
| All consuming forms (including Trainer, Vet and Rider) | Required native selects lacked the same visible required mark as text fields | Forward required state to canonical Field and retain native required, exact accessible labels, errors, disabled state and helper association |
| Shared data tables | Hover showed row context but keyboard focus did not | Same calm row background for focus-within; no click/selection/pagination handler changes |
| Shared filter toolbars | Navigation links were treated like growing filter fields | Content-width button/link actions; inputs keep available width. Counts and server/page scope remain feature-owned |
| Shared field layout | Long labels and narrow controls could compete for width | min-width:0 and wrapping label text without reducing contrast or hiding content |

Trainer, Vet and Work Rider retain their existing role-specific workflow layouts; shared control fixes apply where used. This is not a second theme or a claim that every role screen was rewritten. Existing revised dropdowns and Medical horse search from FORM-UX-SHORTCUTS-20261102.md remain intact.

## Behavior boundaries

- No default strength, guessed health state, inferred suitability or auto-selection. Empty strengths still mean unknown. Clear-all sends the same existing empty array when the user later saves.
- Strength controls lock during save/loading. Dirty/failed-save behavior remains, no extra POST from toggling a UI choice.
- Required-star changes are presentational; native validation was already required. Accessible labels stay stable and explicit labels supplied by consumers are preserved.
- Semantic warning/danger colors are retained. Decorative check marks use CSS borders, not generated text that changes checkbox accessible names.
- No sample fallback, fixture login, invented metrics or silent success. Browser UX checks leave business forms unsaved.

## Verification

- 139/139 focused tests across 12 shared/form/Groom/template/Medical/Flow4 files PASS.
- Final 83/83 tests across separate Owner page/application routes and shared navigation files PASS, including five new lifecycle/availability cases. Together with the unchanged 139-test set, 222 tests across 15 files; no full suite claim.
- TypeScript, ESLint, production Vite build, production bundle guard and diff checks PASS. One worker/bounded heaps; only existing local FE preview restarted.
- Initial before snapshots cover 49 representative role/route renderings. Their short render delay did not guarantee all data completed, so an initial Owner loading image is not treated as a final content verification.
- After audit uses visible loading-state completion, actual API status tracking and fonts before screenshots. A helper initially matched the table caption “trang đang tải” as a loader; fixed to match loading text only at its beginning. An earlier generic network counter was inconclusive and abandoned; persistent-stream causation was not established. No app assertion/security rule or product timeout was weakened.
- Final representative audit: 49 role/route renderings across all seven roles, no unfinished visible loading state, horizontal document overflow, unlabeled visible input, unnamed button, uncaught page error or API HTTP failure.
- Interaction receipt: 13 checks / 21 actual API requests. Strength keyboard selection/clear-all and 44px targets at 1440/1280/1024/390; table keyboard focus; template action sizing; Groom date alignment/wrapping; Owner tabs. No business mutation.
- After the final Owner wording change: 12 additional targeted browser checks / 14 actual API requests PASS, covering DRAFT list/Health, independent stored availability, retained tabs, and both pages at 1440/1280/1024/390. No uncaught page error or API HTTP failure. The earlier 49-route audit was not mechanically rerun for this isolated Owner change.
- Evidence/screenshots are local in `.preview-local/racehorse-training/ux-audit-role-polish-after.json`, `role-polish-interactions.json` and `owner-readiness-ui.json`. Temporary isolated browser contexts were closed. No password, token, cookie or Authorization header is recorded by these scripts.
- Final commands: `vitest run src/features/owner/OwnerPage.test.tsx src/features/owner/ownerApplicationRoutes.test.tsx src/layout/layout.test.tsx --maxWorkers=1`; `tsc -b --noEmit`; `eslint .`; `vite build`; `node scripts/check-production-bundle.mjs`; `git diff --check`. All PASS. Existing unrelated line-ending normalization warnings remain.

## Limits

Representative routes and targeted keyboard/viewport checks are not exhaustive every-modal/every-business-state E2E. No full screen-reader audit, WCAG certification, native toolbar zoom certification, load test or GitHub Independent Gate. Clinical decisions, session gates and permissions remain Backend-owned. Flow5 and automatic horse-code allocation remain outside this presentation batch.
