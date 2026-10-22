# Local main release candidate — 22 October 2026

Phase 2 preparation follows the Phase 1 BE candidate. BE main promotion is blocked by inherited PR25 CHANGES_REQUESTED; this independent FE work does not claim that Phase 1 has passed or bypass its priority.

## Preserved source

- FE baseline is main `f3676d142d617087892531cbe74cc1f91d0408d4`.
- Existing local merge `8a9ac0252ea75f42ff96a7f340c6b7604a7724f6` and Hoang PR22 HEAD `dfd720755e61f3dcc032fb231fc55d4b08da300a` remain ancestors. No squash/rebase or author rewrite.
- Selected 45 source/example-env WIP files were copied and hash-verified from the existing local demo. The source worktree and its running artifacts/databases were not overwritten.
- FE PR22 approval is still required. A release PR does not turn unreviewed work into approved work.

## New required shared screens

The main release directive authorizes completion of essential shared administration/account/notification screens in the existing app. No optional module is implemented.

| Screen / route | Source / contract | Current candidate behavior |
|---|---|---|
| Staff & Users `/admin/users` | Figma288:3192 / CORE050, shared UserPage | API list, search, role/status filters, paging and edit navigation |
| Create/Edit `/admin/users/new`, `/admin/users/:id/edit` | Figma289:3336,289:3538 / shared UserInput | Validated profile/one role; real create/update; separate activate/deactivate; self-deactivate disabled; in-flight guard and preserved failed form |
| Roles `/admin/roles` | Figma290:3537 / shared RoleInfo | Read-only approved core permission matrix plus actual Backend role catalogue; no permission editor or client authority |
| My Account `/account` | Figma292:3637 / CORE049 API | Real profile name update, readonly email/access, password change, sign-out; passwords stay component-memory only |
| Notification Center `/notifications` and header drawer | Figma322:5410 / CORE053 API | Recipient-scoped real list/unread/read/read-all; filters and paging; fixed-route guarded links; honest errors; simulated notices explicitly labelled |

The read-only permission reference is transcribed from approved Figma and excludes deferred optional modules. It is documentation, never an authorization engine. The Backend enforces role and row scope.

Existing shared controls, canonical API/JWT client and V2 shell are reused. New drawer/feature modules are lazy-loaded. Global search is disabled where no search handler exists rather than appearing functional. No runtime sample store or fallback was introduced.

## Limits and gates

- The approved create-user API always creates ACTIVE accounts and does not accept a password. The Figma initial-INACTIVE choice is therefore not fabricated; the screen explains ACTIVE and supports a separate persisted status action after creation/edit.
- Email is readonly on self profile because the approved update-self DTO accepts fullName only.
- Public forgot/reset UI remains unavailable for production while its approved email-delivery readiness condition is unmet; no sent-email or database success is invented.
- Header unread badge subscription/realtime notification reconnect and full latest-SHA browser/SQL interaction acceptance remain Phase 3/4 work. The center/drawer query real APIs when opened.
- Preserved Training/Medical/Horse UI still needs end-to-end verification against reviewed BE main. Source coverage is not functional acceptance or Figma fidelity PASS.
- Test suites are deliberately SKIPPED in Phase 2 under Leader direction. Regression sources were updated/added and compiled by TypeScript. No fixture or SQL/browser PASS is claimed for this revision.
- Use `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`. On Windows paths containing `&`, invoke npm scripts with a process-local PowerShell7 script-shell; do not change global npm settings.
- Production bundle guard must exclude role-test, sample and developer modules. No Vercel settings or hosted deployment changed.
- Main still has one approval, last-push approval and resolved-conversation requirements. Do not merge this candidate while PR22/release review is pending. Main historically auto-deploys; this task did not inspect or modify its hosting configuration.

Resume after review: verify main/head unchanged, resolve required reviews, merge using merge commit only if permitted; then wire final BE main and enter Phase 4 fresh-clone testing. Do not run UI polish before all three real core flows pass.
