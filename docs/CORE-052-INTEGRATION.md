# CORE-052 integration checkpoint

Starting integration:0720f3f2cd0bb8a3735d13ce59387dbaf4d34f2e, clean. Source:786d39713ed050e890503d7aaf600f5d949e9ff2, containing638d2a3 → dd58ef0 →786d397. Imported feature files and textual handoff only; no historical router patch or binary evidence was applied.

CM `/dashboard` mounts ClubManagerDashboardEntry through ManagementProvider; six other roles retain WorkspacePage. `/admin/audit-log` is CM-only and read-only. Horses, Pending Activation, Register Horse and Incidents point to existing authorized screens. Users/Registrations/Permissions shortcuts remain off; Reports deferred. The module is loaded on demand.

Default service uses the canonical HTTP/auth client and approved shared.openapi.yaml. Explicit sample mode uses the single `racehorse.business-samples.v1` graph: horse/box/session/incident counts reflect current records. Accounts mean seven sample identities; registrations are not modeled (zero seeded records). Audit SAMPLE_SNAPSHOT rows are synthetic projections, not persisted backend events, approved CORE-051 vocabulary or evidence of audit logging. Both screens disclose this. Samples never rescue a real HTTP failure; management mutations are rejected.

Source authority: project-context/Racehorse_Core_Flow_Execution.xlsx, SHA25690e8c9fb5814069bc84a62c12a2e6b5215668c138cc030f884320ed1b4e588a0. CORE-052 tracker owner/status remain Cao Thanh Dũng/To Do; dependencies CORE-002/003. Đức remediation and this integration follow direct Leader exceptions. Preserve `src/features/management/*`; F5 path exception remains pending formal approval. No workbook or status edits.

Live Figma308:4605 and308:5271 context/screenshots were read. Current source provides approved contract-backed core widgets; complete Figma/business-field gaps and Hoàng UI review remain Gate items. Feature Gate ondd58ef0 previously failed; this integration does not convert it to PASS.

Fresh browser sample QA: CM Dashboard → Horses/Pending Activation/Incidents/Audit; audit local dates serialized to UTC; empty/reset, next page and refresh verified. Dashboard and Audit have no horizontal overflow at1280, Audit also at1440. Trainer audit denied, normal unauthenticated link returns login; Performance/Evaluation and Vet Medical smoke checks retained. Browser console warning/error capture returned no entries in the observed run. Screenshots/logs live in workspace `.preview-local/official-fe-audit/core052-*`.

Regression tests now follow CM Dashboard and Account menu → Your account → Sign out, preserving logout/session assertions. No test was deleted or timeout increased. Author checks are separate from Independent Gate; final results are recorded with the exact committed HEAD in the workspace checkpoint.

CORE-025/041 readiness: fetched remote refs contain no corresponding feature branch; exact-title GitHub PR searches returned no results. Only assigned/calendar/exercises are present under training. No published exact handoff HEAD, completeness or Gate has been verified, so no duplicate owner module was implemented. Current three-flow gaps remain in FE-COVERAGE-MATRIX.md. Next executable integration work is route-level code splitting while waiting for Hoàng's handoff; no DB/cloud work is required.
