# Seven-role action affordance correction — 2026-11-02

Long rejected the flat row actions because reassignment and cancellation looked like plain text. This batch corrects that direction across shared secondary table actions, then reviews all seven roles. Existing WIP stays in feat/flow4-local-review. No Backend, JWT/RBAC, API contract, business-state or database business-data changes; no commit/push/main merge or cloud action.

## Design references and Racehorse choices

- [Microsoft Fluent: Button usage](https://fluent2.microsoft.design/components/web/react/core/button/usage) distinguishes action emphasis, permits outlined supporting controls and describes readable contrast.
- [Atlassian: Color roles](https://atlassian.design/foundations/color/) distinguishes neutral supporting actions, brand emphasis and dangerous actions.
- [IBM Carbon: Data table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) separates table-level controls and row-specific actions.

These inform the hierarchy, not a copied framework, asset or source implementation. Racehorse keeps its approved navy/emerald identity and existing shared React components.

## Implemented

1. Remove the blanket CSS rule that stripped secondary-button borders inside table cells. Shared secondary buttons are again white, outlined slate controls without a heavy shadow, with a more visible border token.
2. Add the optional shared Button variant danger-outline. Its visible label, red text/border, hover and focus distinguish entry into a dangerous confirmation. Existing filled danger controls remain the final confirmation; pending/disabled behavior is unchanged.
3. Daily care groups actions by horse with an accessible group label. Change Groom and Cancel share a compact row; History is an outlined independent action beneath them. Icons reinforce labels, never replace them. No handler, permission, state guard or payload changes.
4. Shared small buttons use 13px text and 12px horizontal padding. This keeps repeated actions identifiable without the oversized spacing that forced one action per line.
5. Fix notification-bell geometry: a 44px target contains the number badge instead of positioning it outside a 32px target. Tabular digits and visible keyboard focus are retained. Exact counts, unread semantics and the existing 99+ cap remain.
6. Daily-care summary cards receive explicit information/warning/success/neutral accent variables. The previous positional decorative colors overrode the feature's intended meaning. Count values and semantics remain unchanged. Scoped metric labels use readable sentence case.

## Verification

- 180/180 focused tests across 10 files PASS: Stable Care, shared buttons/tables/toolbars/overlays, Horse application, Medical, Training, Owner and navigation. Includes new no-POST confirmation-entry coverage and outlined-danger pending protection.
- A test-only mock typing cleanup was separately verified: Stable Care 17/17 plus TypeScript/targeted lint PASS.
- Header regression: navigation/layout 29/29 PASS.
- Final metric/button/screen checks: 35/35 across 3 files PASS. These overlap earlier groups and must not be added as unique tests.
- Full ESLint, TypeScript, production build, production bundle guard and diff checks PASS. Subsequent focus-outline color alignment is CSS-only and gets the final build and browser style check.
- Real API-only browser audit follows each role's actual sidebar menu, plus known detail/form routes. 103 role/route renderings and 412 viewport checks at 1440/1280/1024/390. It includes eight existing user edit pages, horse tabs, Program/Session/Evaluation, case/treatment pages, Groom precheck and Rider feedback/state pages. No document overflow, unlabeled visible controls, unnamed buttons, uncaught JavaScript errors or API HTTP failures.
- This initial 103-route receipt is not an unconditional PASS: 50 rows flagged the badge extending outside its small button (visible in screenshots rather than truncated text). The bell geometry is corrected and checked separately across all roles/widths. One Trainer Notifications visit waited beyond 10 seconds restoring authentication; isolated final verification completes. Cause of intermittent restore/load delays remains UNKNOWN.
- Final interaction receipt: 42 checks / 45 real HTTP API requests PASS across all seven roles. It checks header containment and 44px targets at all four widths, actual task borders/text contrast, action alignment, keyboard focus, guarded Cancel/Reassign modal entry/Back, History, Groom permission separation, all existing Vet case tabs, semantic summary colors and isolated Trainer Notifications.
- Final CSS refinement: native danger buttons supply local semantic focus tokens, so the V2 global focus rule also draws the correct red outline. An intermediate check caught the global green focus override; it was fixed rather than weakening the assertion. Final Club Manager follow-up: 11 checks / 9 real requests PASS, including outline color matching the danger text, still without mutations.
- No business mutation requests are made by these browser scripts. Real login may update normal authentication metadata. Contexts and temporary browsers close in finally blocks.

## Exact local evidence

Private artifacts under .preview-local/racehorse-training:

- seven-role-action-audit.json, action-audit-ROLE-route.png: full initial audit, findings preserved.
- outlined-task-actions.json/png: successful final interactions and current care table.
- outlined-task-actions-CLUB_MANAGER.json: final focus-token correction check. outlined-task-actions-failed.json preserves the preceding diagnostic failure.
- action-affordance-build.log and action-affordance-final-build.log.

An initial interaction attempt hit a navigation/load timeout before completion. It is not a PASS. A diagnostic retry completed the 42 checks; no timeout, security assertion or access protection was weakened.

The preceding intermittent Owner aggregate-load delays also remain historical limitations; Owner's seven routes complete in the current 103-route audit. A later success does not establish their cause or guarantee latency.

## Limits and review

This is rendered UI/read-only interaction coverage, not full write-path E2E, all modal combinations, load testing, full screen-reader verification or an Independent Gate. No successful cancellation/reassignment is claimed from opening a confirmation. Source remains local and main is untouched.

For future screens: use visible outlined controls for consequential row actions; use explicit danger-outline for entering destructive confirmation; keep a separate filled confirmation and genuine pending/error states. Do not replace explicit labels with icon-only controls or infer role permissions in styling.
