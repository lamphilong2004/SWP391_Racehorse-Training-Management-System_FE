# Action placement and page hierarchy — 27 October 2026

Uses the existing Racehorse navy/emerald tokens, fonts and controls. No alternate theme, API client or sample store is introduced.

## Shared pattern

- `PageHeader`: title and description first; utility/secondary actions followed by at most one primary action. Long labels wrap instead of clipping. `FlowShell` now reuses this header.
- `ActionBar`: contextual text on the left, secondary/cancel followed by primary/submit on the right. It wraps on narrow widths and preserves DOM/keyboard order. It does not supply a submit handler, validation or permissions.
- Buttons remain content-sized inside the action group. Intentional full-width controls elsewhere, including login, keep their existing behavior.
- `TableToolbar`: a subtle surface groups existing search/filter fields; the result count is separated and still states whether filtering covers the server dataset or only the loaded page.
- Existing tabs have more consistent hit areas and a bounded horizontal scroll region.

```tsx
<ActionBar leading={<span>Changes are not saved yet.</span>}>
  <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
  <Button type="submit" disabled={pending}>Save</Button>
</ActionBar>
```

Keep the owning form's pending guard and API error/retry handling. Do not close a failed form or display success before the server confirms the write.

## Applied screens

| Area | Change |
| --- | --- |
| Medical list | Create and herd-health navigation grouped in the page header; existing page-scoped filters retain truthful counts. |
| Medical case | More compact summary; clear tabs including Tái khám; closure kept in a separate amber-edged panel with cancel before confirm. |
| Medical forms / treatment editor | Aligned fields, compact right-aligned save/cancel footer. |
| Session detail | Utility reload, secondary calendar/result links, one primary action appropriate to current server status. Completed sessions show evaluation guidance instead of start instructions. |
| Groom assignment | Assignment stays beside its candidate control in a compact action footer. |
| Program / session wizards | Step/context remains separate from back/continue/create actions. |
| Evaluation | Terminal-state reminder remains beside the save action; interrupted state is preserved. |
| Notifications | Unread count and mark-all action grouped; each row has consistent read/navigation controls. |
| Account | Shared heading, compact profile/password controls, separate workspace/logout footer. |

## Verification and limits

- Focused fixture tests: 121 tests in 14 files passed in the affected run; the 17-test Program Creation file passed in a separate isolated fork run. A subsequent session-detail regression adds one new assertion case (4/4 in that file), giving 139 distinct affected tests with passing evidence across these runs.
- The earlier threads run had 9 Program Creation failures (timeouts followed by missing fixture controls); the unchanged 17/17 file passed when run alone with a normal fork, in 16.54 seconds. No timeout or assertion was weakened. The initial sandbox fork stalled and was stopped.
- ESLint, TypeScript, production build, production bundle isolation, 13/13 staging policy checks and diff check passed. The repository-wide suite was not run.
- Real browser: existing Vet and Trainer accounts; real SQL-backed medical list/case 1, exam tab, create-form cancel, closure confirmation/cancel, account, notifications, session 3 and its persisted evaluation. No clinical, notification-read or session-save mutation was submitted. Login/logout writes only normal authentication metadata.
- Medical form document/main widths were contained at 1440, 1024 and 390 pixels. The save button measured about 124 × 40 pixels on desktop. Account actions measured 99–122 pixels wide rather than stretching across the card.
- This is affected-screen and shared-pattern verification, not a claim that every role/route/state has been exhaustively checked or that a new database workflow passed E2E.

## Current local environment

For this verification, port 5173 belongs to another project. Racehorse FE runs at `http://127.0.0.1:5214`, proxying the unchanged Backend at `http://localhost:8080`. The Leader started SQL Server; the existing `racehorse_presentation_20261023` database and strict TLS/JPA validate configuration were retained. No source change fixes ports or changes deployment policy.
