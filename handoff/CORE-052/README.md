# CORE-052 review handoff

CORE-052 remains Gate Pending. Independent Gate on `dd58ef0` failed; passing author tests do not supersede that decision. Real Backend/SQL/RBAC runtime is NOT VERIFIED.

## Governance exceptions

- Ownership discrepancy: the official Project Tracking workbook assigns CORE-052 to **Dung**. Leader explicitly authorized **Duc** to remediate its FE implementation as an ownership exception. The workbook, dependency list and DoD have not been edited. Formal ownership synchronization remains with Leader.
- F5 proposed architectural exception: retain `src/features/management/*` temporarily, pending explicit Leader approval. No relocation is performed. A future move must assess `routes.tsx` exports, provider/service imports, tests, shared-router consumers and any harness-only imports; then verify each consumer and build. Current integration exports remain stable.

## F2 navigation and F3 integration boundary

The feature adds semantic keyboard-accessible links to `/horses`, `/horses/pending-activation` and `/incidents`. The pending path reuses the canonical `/horses` prefix because the baseline shared constants have no dedicated pending-activation constant. These destinations and CM-compatible guards were read from harness `6a7b6f4cf8ef67a2bbf9e862696a35540417525b` (`src/app/router.tsx`, `IncidentRoutes.tsx`). No shared route, guard or navigation file is changed.

Users/Registrations navigation is not enabled: CORE-050/048 destination integration and authorization remain unconfirmed. Reports remains deferred. Existing Create User/Permissions shortcut readiness stays opt-in through `ManagementProvider`; no new destinations are invented.

Integration Owner must mount `ClubManagerDashboardEntry` at the existing `/dashboard` and `core052AuditRoute` at `/admin/audit-log`, preserving other roles' workspaces and all Main Flow routes/guards. The feature branch's base dev has no Horse/Incident routes mounted: fixture destination QA verifies link behavior and shared guards only, **not official FE integration**. F3 and official end-to-end navigation acceptance remain Integration Owner dependencies. Do not apply the archived router patch wholesale.

## F4 accessible evidence archive

All unique evidence remains reachable on GitHub at immutable commit `dd58ef0904e7c2a713f9bb22258a028ee04e51f2`. Archive entries were confirmed accessible through GitHub before removing binaries/patch from the current feature tree. Normal commits preserve this history; no force push or history rewrite is used.

- [Figma comparison: five before/after/date-filter captures](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/tree/dd58ef0904e7c2a713f9bb22258a028ee04e51f2/handoff/CORE-052/figma-alignment)
- [Original Dashboard fixture](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/blob/dd58ef0904e7c2a713f9bb22258a028ee04e51f2/handoff/CORE-052/dashboard-fixture.png)
- [Original Audit fixture](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/blob/dd58ef0904e7c2a713f9bb22258a028ee04e51f2/handoff/CORE-052/audit-fixture.png)
- [Historical router patch, reference only; not approved for direct application](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/blob/dd58ef0904e7c2a713f9bb22258a028ee04e51f2/handoff/CORE-052/router-integration.patch)

Fixtures contain synthetic data and are not evidence of real BE/SQL/RBAC. Current remediation browser QA is BLOCKED: the computer-use kernel fails to start with `CreateProcessSecurityEnvironment failed (HRESULT = 0x80070020)`, including after a kernel reset. No new screenshot or browser PASS is claimed. Keyboard navigation and date/timestamp behavior are covered by the feature's component tests; archived browser evidence predates remediation and must not be presented as verification of this batch. Integration Owner/Independent Gate must rerun browser fixture QA when the runtime is available.

## F6 presentation

Approved Figma Audit Log `308:5271`, table `313:5232`, uses `20 Oct 2026` and a separate `10:02` line. Date presentation now uses `en-GB` day/month/year and a 24-hour local clock. Original API ISO timestamps remain in `time.dateTime` and `title`; timezone conversion, UTC filters and Action codes are unchanged. Q-15 action-label mapping and prior business-field contract gaps remain pending.
