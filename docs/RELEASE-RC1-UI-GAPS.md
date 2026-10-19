# Release rc1: required UI gaps

Source audit: `c2bdc96df360b86a1a1d0fe4224d3a36a1ae4fba`, 19 October 2026. This is an inventory, not a CORE completion or Figma fidelity Gate. Existing contributor source is preserved. No missing feature is implemented by the release configuration patch.

Figma file: `tm7dpgAQbHReZ7tlQeQJlc`. Frames below include tabs, dialogs and wizard states; they are not a count of independent pages. Required shared support is distinguished from the three business flows. Ownership follows project-context; an ownership transfer requires Long's decision.

| Figma node(s) | Route / surface | Required scope | CORE / owner | Existing source | Status |
|---|---|---|---|---|---|
| `77:317` | `/training/programs` | Flow 2 | CORE-022 / Hoàng | `src/app/router.tsx`, `OwnerHandoffPage.tsx` unavailable placeholder | MISSING |
| `120:5086` | `/training/templates` | Flow 2 template subflow | CORE-041 / Hoàng | Same placeholder; wizard selection is not template management | MISSING |
| `124:5277`, `126:5297`, `127:5321`, `140:5824` | Template detail drawer | Flow 2 | CORE-041 / Hoàng | Template selection/readback exists in `features/program-creation`; management drawer absent | MISSING |
| `128:5342`, `131:5475`, `136:5613` | Template create/version/duplicate | Flow 2 | CORE-041 / Hoàng | Management forms/routes absent | MISSING |
| `78:288`, `79:288`, `80:423`, `96:286` | `/training/programs/:id`, Overview/Progress/History | Flow 2 | CORE-041 / Hoàng | Unavailable placeholder; wizard result and assigned list are different surfaces | MISSING |
| `80:778`, `116:303`, `141:5774` | Program adjustment/request/review dialogs | Flow 2 | CORE-041 / Hoàng | No management/request/review UI | MISSING |
| `288:3192`, `289:3336`, `289:3538` | `/admin/users`, user create/edit/deactivate | Shared administration required by DEC-009 | CORE-050 / Dũng | List placeholder; create/edit routes absent; registration approval is separate | MISSING |
| `290:3537` | `/admin/roles` | Shared administration required by DEC-009 | CORE-050 / Dũng | Unavailable placeholder | MISSING |
| `292:3637` | `/account` | Shared account UI | CORE-050 / Dũng | `src/pages/AccountPage.tsx`: identity, roles and logout | PARTIAL |
| `291:3630` | Forgot/reset password | Approved shared account scope, subject to production-readiness restrictions | CORE-050 / Dũng | `src/pages/LoginPage.tsx` shows unavailable; pages absent | MISSING |
| `321:5356`, `322:5410` | Header notification drawer, `/notifications` | Shared support / Flow 2 alerts required by DEC-009 | CORE-054 / Hoàng | Placeholder; session-specific monitoring stream is not this shared layer | MISSING |
| `151:6627`, `155:7089`, `156:7383` | `/training/monitoring?sessionId=…`, Alert Detail | Flow 2 | CORE-031 / Hoàng | `features/live-monitoring/LiveMonitoringPage.tsx`: Pause/Stop/Acknowledge, no Resume or Alert Detail dialog | PARTIAL |
| `272:1791` | Threshold override dialog | Flow 3 interlock | CORE-020 / Hoàng | `features/restrictions`: threshold reads; override write UI absent | MISSING |
| `210:9145` | Medical case Injury tab | Flow 3 | CORE-036 / Đức | `features/medical/InjuryMap.tsx`: unconditional 2D fallback, no 3D interaction | PARTIAL |
| `293:3710` | Access denied / public not-found variants | Shared foundation | CORE-008 / Hoàng | Inline denial exists; explicit `/403` absent; wildcard is auth-protected | PARTIAL |

Corrections to the older `FE-COVERAGE-MATRIX.md`: Head Trainer Medical Summary (`/medical/summary`) and Owner Portal are now mounted. Baseline, Horse History and readiness acknowledgement also have source/entry points. Do not continue reporting these as wholly missing. `/incidents` and `/incidents/:incidentId` intentionally share `IncidentAccess`; `/medical/my-tasks` redirects to `/care/tasks`.

Workbook deep links for baseline, medical examination/injury/recovery and pedigree do not all match mounted routes/tabs. These are compatibility gaps to reconcile, not proof that each corresponding screen is absent. Reduce-intensity remains a proposal; no new API or business rule is assumed here. Race history, finance, inventory, nutrition and general daily-care planning remain deferred optional scope.

Leader decision needed: prioritize separate owner PRs after rc1 for these required gaps, and explicitly authorize any ownership transfer. This release does not establish complete UI coverage or real Backend/SQL integration.
