# PR23 notification unread badge — focused re-review

Review patch base: `ce3cb1943f93cc08a2a9588af1962e1f8194c251`, existing
`release/fe-main-local-20261022`. This patch stays on PR23; no main/dev merge,
deployment, Backend change, new API or UI redesign.

## Fix

AppShell previously passed no live count to Header, whose default was0. The center
kept its own unread query, so even successful read/read-all did not update the bell.

`NotificationsProvider` now lives inside canonical AuthProvider and supplies the
same count/request boundary to AppShell, center and drawer. It queries existing
`GET /api/notifications/unread-count` after login and on focus/online/storage recovery.
Successful read/read-all invalidates notification lists and queries the count again.
It never decrements locally, invents zero, accepts malformed counts or treats failed
mutations as success. Unknown/error counts hide the numeric badge and provide an
accessible status; the center exposes retry. Existing v1 Header props remain usable
for standalone component consumers; a mounted authenticated provider takes precedence.

The canonical JWT transport remains unchanged. Requests bind the current stored
session's token, abort on disposal, reject stale results and apply auth errors only
while that same session remains current. A late old-account401 must never sign out
the new account. Account/login changes reset provider consumers; snapshots prevent
old counts showing during same-user token replacement. Storage events also invalidate
the old count/list without issuing requests with a missing or replacement token. No extra token/count storage
or sample business store is added. Protected role-test identities retain their
existing transport prohibition and cannot reach the server.

This patch covers initial REST count and read/read-all synchronization, including
focus/online reconciliation. Notification STOMP push/subscription/reconnect is still
a separate known gap; no websocket acceptance claim is made here.

## Focused regression evidence

84/84 tests passed across five files, one worker:

```powershell
node node_modules/vitest/vitest.mjs run src/shared/notifications/NotificationsProvider.test.tsx src/app/pendingScreens.test.tsx src/layout/layout.test.tsx src/shared/auth/AuthProvider.test.tsx src/shared/auth/authApi.test.ts --maxWorkers=1
```

25 notification tests cover seven roles, initial count, center/drawer read/read-all,
duplicate submission, denied/malformed mutation, invalid/failed count and retry,
stale response ordering, account switch including late401/mutation, logout/relogin,
inactive/expired session handling, cross-tab session clearing and StrictMode replay. Existing v1/responsive
layout tests and canonical auth regressions are included.

Two pre-existing logout test selectors still expected Sign out on the workspace.
They now navigate through the existing Account menu and assert `/account`, then
retain the same204/storage-clear and network-failure disclosure assertions. Runtime
auth/account behavior was not changed. The Owner drawer test now scopes its heading
and empty-state assertion to the actual notification dialog, avoiding an unrelated
workspace heading with the same label. No assertions or security protections removed.

Final lint/typecheck/build/bundle/policy results and source hashes are in
`PR23-NOTIFICATION-EVIDENCE-20261022.json`. Full suites are not claimed.

## Real local API/SQL evidence — separate from fixtures

Against unchanged BE executable `23cd849d0a88b22cc6d969ca760427e5b6f2505c`
(remote docs-only release `9f07b2d2ce038fe37d02687e20a2384f447027dc`), existing
isolated DB `racehorse_local_api128_20261021_163300`:

- 38 real HTTP requests through FE localhost5173 proxy to BE8080;96 assertions PASS.
- Unauthenticated unread count401; all seven real JWT roles return valid counts
  matching their unread lists. Foreign-recipient read404 does not affect the owner.
- Existing notification11 for recipient3: read timestamp confirmed, count decremented,
  repeated read timestamp stable, read-all returns0, count/list refresh reflect0.
  Other account's unread count stays unchanged. No new notification/seed/mock created.
- Independent strict-TLS JDBC SELECT-only readback3/3 PASS verifies persisted read
  timestamp, no remaining unread for the affected recipient and unaffected other
  recipient. No database reset/migration or SQL service/config changes.

These are HTTP/SQL behavior checks, not an authenticated browser/header E2E. No real
password, JWT, cookie, Authorization header or notification body is in the evidence.

## Attached historical baseline — do not relabel as this patch's E2E

The existing42-request/56-assertion/5-SQL-check baseline was run on exactly:

- FE executable `e48f8383c19464d01d2d45fc288d8a393ec52bc4`.
- BE executable `23cd849d0a88b22cc6d969ca760427e5b6f2505c`.

[Immutable sanitized baseline evidence](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/9f07b2d2ce038fe37d02687e20a2384f447027dc/docs/integration/RUNNABLE-BASELINE-EVIDENCE-20261022.json).
That artifact includes the later independent SQL5/5 result. The original HTTP-only
file's earlier pending marker is superseded by that separate SQL readback. These
results do not verify this new FE patch or full browser E2E and were not rerun.

## Review hold

Request fresh independent review on the exact pushed patch HEAD. PR23 was already
Ready at pickup, with Hoang/`wangf28` and Duc/`minhduc1204` requested. Required approval,
last-push approval and conversation resolution remain enforced. BE32's inherited
review hold is unchanged. No Independent Gate PASS, approval or merge is issued by
this author task.
