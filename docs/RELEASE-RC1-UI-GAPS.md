# Release rc1: required UI gaps

Current source audit: `origin/main` at `bfa814776d16e2b7cb054e5600714cd6382e1662`, 19 October 2026, inspected in `_gate-monitor/fe-v2-foundation`. The earlier rc1 inventory used `c2bdc96df360b86a1a1d0fe4224d3a36a1ae4fba`. This is a source and design-access inventory, not a CORE completion, browser interaction test or Figma fidelity PASS. Existing contributor source is preserved. No missing feature is implemented by this audit.

## Exact authoritative sources

- Workspace: `D:/FPT/Kì_9/SWP391/Racehorse Training & Management System`.
- Primary workbook: `project-context/Racehorse_Core_Flow_Execution.xlsx`, SHA256 `90e8c9fb5814069bc84a62c12a2e6b5215668c138cc030f884320ed1b4e588a0`, rehashed for this audit. Use its **Task Playbook** and **Figma Screen Registry**; relevant Task Playbook rows are CORE-022 row23, CORE-041 row42, CORE-050 row51 and CORE-054 row55. The read-only extraction is `.preview-local/official-fe-audit/tracking-extract.json`; its recorded workbook hash matches the file above.
- Approved scope: `project-docs/decisions/DEC-009-core-execution-scope-resolutions.md`, sections3–5: Flows1–3, the medical/training interlock, shared administration/account/audit/notifications and the minimum Owner workspace are required. General Flow4 care planning and expanded Owner/race/finance content remain deferred.
- Release continuation: `C:/Users/admin/Downloads/Codex_FE_Release_Handoff_2026-10-19.md`, sectionsE–F: inventory missing UI, preserve contributor work, keep new owner screens on separate authorized work, and do not apply an unapproved UI/UXv2 theme.
- Current code evidence: `src/app/router.tsx:32` (five unavailable entries), `:89` (existing create-program wizard), `:99` (unavailable program detail), `:131` (existing HT medical summary), `src/app/OwnerHandoffPage.tsx:11` (truthful unavailable state), and the feature files named below. Current source takes precedence over stale completion claims in `FE-COVERAGE-MATRIX.md`.

## Live Figma evidence

Figma file: `tm7dpgAQbHReZ7tlQeQJlc`. Official `mcp__figma` access was verified with `get_design_context` for known node `77:317`, including its screenshot. `whoami` reported `longlpse182769@fpt.edu.vn` with a Full seat. This establishes **FIGMA_ACCESS_PASS for the audited nodes**, not approval of new v2 designs or visual fidelity of the website.

Context and screenshots were returned for: `77:317`; `124:5277`, `126:5297`, `127:5321`, `140:5824`, `128:5342`, `131:5475`, `136:5613`; `78:288`, `79:288`, `80:423`, `96:286`; `80:778`, `116:303`, `141:5774`; `288:3192`, `289:3336`, `289:3538`, `290:3537`; `291:3630`, `292:3637`; `321:5356`, `322:5410`; `156:7383`, `272:1791`, `210:9145`, `293:3710`.

Library node `120:5086` returned sparse metadata rather than full context. A direct `get_screenshot` succeeded; the screenshot was correlated with full child context and screenshots for header `120:5193`, filters `120:5231`, active template card `121:5187` and archived template card `123:5338`. The parent metadata alone is not an implementation specification. The remaining wizard and monitoring state frames referenced below were not freshly re-read in this bounded audit. Temporary Figma asset URLs are deliberately not persisted here.

## Required screen inventory

Frames include tabs, dialogs and wizard states; they are not a count of independent pages. `MISSING` means business UI is absent, even when a guarded placeholder route exists. `PARTIAL` means relevant source exists with a concrete gap. No `DONE` is inferred from a route, screenshot or API binding alone.

Ownership follows project-context. CORE-022 and CORE-041 are Hoàng's distinct tasks: the HT Program List belongs to CORE-022; template management and program detail belong to CORE-041. CORE-050 records **Cao Thanh Dũng** in the primary workbook. Under the current FE/BE separation, no replacement FE assignment was verified; its **current FE implementation owner is unassigned pending Long's decision**. This does not transfer the tracker task to Hoàng, Đức or Long.

| Figma node(s) | Route / surface | Required scope | CORE / owner | Existing source | Status |
|---|---|---|---|---|---|
| `77:317` | `/training/programs` | Flow 2 | CORE-022 / Hoàng | `src/app/router.tsx`, `OwnerHandoffPage.tsx` unavailable placeholder | MISSING |
| `84:286` … `91:299` | `/training/programs/new`, seven wizard steps and result state | Flow 2 | CORE-022 / Hoàng | `features/program-creation/ProgramCreationPage.tsx:21`, `ProgramSteps.tsx`: existing wizard, template selection and created-program readback; full detail/navigation and all Figma projections are not established by this audit | PARTIAL; existing wizard is not missing or a substitute for the list/detail |
| `120:5086` | `/training/templates` | Flow 2 template subflow | CORE-041 / Hoàng | Same placeholder; wizard selection is not template management | MISSING |
| `124:5277`, `126:5297`, `127:5321`, `140:5824` | Template detail drawer | Flow 2 | CORE-041 / Hoàng | Template selection/readback exists in `features/program-creation`; management drawer absent | MISSING |
| `128:5342`, `131:5475`, `136:5613` | `/training/templates/new`, `/training/templates/:id/edit`; version/duplicate form states | Flow 2 | CORE-041 / Hoàng | Management forms/routes absent; these are not extra independent routes per state | MISSING |
| `78:288`, `79:288`, `80:423`, `96:286` | `/training/programs/:id`, Overview/Progress/History | Flow 2 | CORE-041 / Hoàng | Unavailable placeholder; wizard result and assigned list are different surfaces | MISSING |
| `80:778`, `116:303`, `141:5774` | Program adjustment/request/review dialogs | Flow 2 | CORE-041 / Hoàng | No management/request/review UI | MISSING |
| `288:3192`, `289:3336`, `289:3538` | `/admin/users`, `/admin/users/new`, `/admin/users/:id/edit`; activate/deactivate state | Shared administration required by DEC-009 | CORE-050 / Dũng in tracker; current FE unassigned | List placeholder; create/edit routes absent; registration approval is separate. Live Figma shows filter/table/create/edit behavior, not a placeholder. | MISSING |
| `290:3537` | `/admin/roles` | Shared administration required by DEC-009 | CORE-050 / Dũng in tracker; current FE unassigned | Unavailable placeholder; live frame is a read-only permission matrix, not a permissions editor | MISSING |
| `292:3637` | `/account` | Shared account UI | CORE-050 / Dũng in tracker; current FE unassigned | `src/pages/AccountPage.tsx:10`: identity, roles and logout; full My Account frame not implemented by these basic fields | PARTIAL |
| `291:3630` | `/forgot-password`, `/reset-password`; request/reset states | Approved shared account scope, subject to production-readiness restrictions | CORE-050 / Dũng in tracker; current FE unassigned | `src/pages/LoginPage.tsx:122` shows unavailable; pages absent. Do not enable a production reset workflow before its approved readiness conditions are satisfied. | MISSING |
| `321:5356`, `322:5410` | Header notification drawer, `/notifications` | Shared support / Flow 2 alerts required by DEC-009 | CORE-054 / Hoàng | Placeholder; session-specific monitoring stream is not this shared layer | MISSING |
| `151:6627`, `155:7089`, `156:7383` | `/training/monitoring?sessionId=…`, Alert Detail | Flow 2 | CORE-031 / Hoàng | `features/live-monitoring/LiveMonitoringPage.tsx`: Pause/Stop/Acknowledge, no Resume or Alert Detail dialog | PARTIAL |
| `272:1791` | Threshold override dialog | Flow 3 interlock | CORE-020 / Hoàng | `features/restrictions`: threshold reads; override write UI absent | MISSING |
| `210:9145` | Medical case Injury tab | Flow 3 | CORE-036 / Đức | `features/medical/InjuryMap.tsx`: unconditional 2D fallback, no 3D interaction | PARTIAL |
| `293:3710` | Access denied / public not-found variants | Shared foundation | CORE-008 / Hoàng | Inline denial exists; explicit `/403` absent; wildcard is auth-protected | PARTIAL |

## Consequences and owner boundaries

- Program creation has source and is mounted. It does not complete the missing HT landing/list or the separate program Overview/Progress/History screens. Trainer `features/training/assigned/AssignedProgramsPage.tsx:40` links to the unavailable program-detail route; a working assigned list is not evidence that its destination is complete.
- Template detail, archived/read-only variants, create/version/duplicate, program adjustment and Trainer-request review are mandatory CORE-041 surfaces. Reusing wizard template selection alone does not satisfy them. Backend fields or operations still requiring approval must remain explicitly unavailable, never fabricated to match a design.
- Notifications require both the drawer and center, unread/mark-read interactions and guarded target navigation. `features/live-monitoring/sessionStream.ts:12` only subscribes to three session topics. It does not provide the CORE-054 session-wide notification layer or its reconnect/notification behavior.
- `features/live-monitoring/LiveMonitoringPage.tsx:77` only declares `pause`, `stop`, `acknowledge`; its Trainer action area at line99 has no Resume control. The Rider's PAUSED view directs the user to the Trainer, so this remains a required interaction gap, not just an absent decorative modal. Alert Detail and the Vet threshold override remain separate required dialogs; do not add an unapproved reduce-intensity API.
- No owner screen is implemented or duplicated in this audit. Separate authorized FE PRs should address the gaps after their owner and current approved contract/design are confirmed. Long decides whether any known gap blocks a release; this document does not make that decision.

Corrections to the older `FE-COVERAGE-MATRIX.md`: Head Trainer Medical Summary (`/medical/summary`) and Owner Portal are now mounted. Baseline, Horse History and readiness acknowledgement also have source/entry points. Do not continue reporting these as wholly missing. `/incidents` and `/incidents/:incidentId` intentionally share `IncidentAccess`; `/medical/my-tasks` redirects to `/care/tasks`.

Workbook deep links for baseline, medical examination/injury/recovery and pedigree do not all match mounted routes/tabs. These are compatibility gaps to reconcile, not proof that each corresponding screen is absent. Reduce-intensity remains a proposal; no new API or business rule is assumed here. Race history, finance, inventory, nutrition and general daily-care planning remain deferred optional scope.

Leader decision needed: prioritize the next owner PRs from current main, assign the unallocated CORE-050 FE work explicitly, and authorize any ownership transfer. This inventory does not establish complete UI coverage or real Backend/SQL integration. This audit changes only this document; it does not run product tests or modify code, Figma, GitHub, Production, database or cloud settings.
