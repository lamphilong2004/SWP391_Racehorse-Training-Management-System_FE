# Official FE staging checkpoint

This is the existing `integration/fe-product-main` application, based on `36248523941a3406009212c3fd12c75e9225d63b`. No deployment or cloud resource has been published/provisioned. CORE statuses and Independent Gates are unchanged. CORE-052 remains pending its separate reviewer.

## Launch after Leader approval

Recommended first target: **Vercel Preview**, using the existing FE repository and integration branch. Vercel supports Vite and Git preview URLs; its SPA setup requires a rewrite. Repository permissions, project linkage and actual hosted behavior are not verified by a local build.

1. Obtain Leader approval for publishing the explicit sample build and its audience. Review the exact integration HEAD first. Do not merge to `dev`/`main` or change an existing production project.
2. Import `lamphilong2004/SWP391_Racehorse-Training-Management-System_FE`, select the integration revision, root directory `.`. Use Node **24.x**, install `npm ci`, build `npm run build:staging`, output `dist-staging` (already declared in `vercel.json`). Choose a Preview deployment, not production promotion. If using CLI from the exact reviewed checkout after approval: `vercel link`, then `vercel` (never `--prod` for this checkpoint).
3. In the target Preview environment set **`RACEHORSE_STAGING_MODE=sample`**. No backend URL, account password, JWT or SQL setting is needed. The build overrides sample-only flags and disables developer/presenter tools. Do not enter real/personal records in sample forms. Preserve the project's approved deployment protection; do not weaken it to make a smoke script pass.
4. After deployment run `npm run smoke:staging -- https://<preview-origin>` from this checkout. If protection intercepts it, record that limitation and use an authorized browser session; do not add bypass secrets to scripts or URLs.
5. In the browser verify `/login`, select each of the seven sample roles, navigation/refresh/sign-out, CM Dashboard/Audit, Horse draft, Trainer evaluation/history and Vet case/examination. Refresh each deep link. Inspect console and confirm no backend traffic. `staging-meta.json` identifies build profile and commit. This is a sample UI demonstration, not SQL/live integration.

Local reproduction:

```sh
npm ci
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run test:staging:build
npm run build:staging:sample
node scripts/serve-staging.mjs dist-staging 5196
npm run smoke:staging -- http://127.0.0.1:5196
```

The localhost static rehearsal is separate from Vite dev/harness. Existing dev servers are preserved. Runtime profile changes require a new build. A local `.env` is not uploaded; all `VITE_*` values are public in browser output. No frontend secret belongs there.

## Two explicit profiles

| Profile | Required build environment | Identity and data |
|---|---|---|
| Sample staging | `RACEHORSE_STAGING_MODE=sample` | Explicit seven-role entry; local sample identity and shared browser records. No passwords, backend authentication, HTTP mutations or SQL persistence. |
| API staging | `RACEHORSE_STAGING_MODE=api`, `VITE_API_BASE_URL=https://<public-backend-origin>` | Existing shared auth/session/client, real login and role authority. Set/unset `VITE_BUSINESS_DATA_SOURCE=api`, `VITE_STAGING_SAMPLE=false`, `VITE_DEMO_UI_ONLY=false`; sample/harness flags are rejected. |

The API origin must be HTTPS without a path, credentials, query or fragment; localhost/private IPv4 are rejected. This validation does not prove DNS, TLS, endpoint availability or CORS. Static hosting has no Vite `/api` or `/ws` proxy. The BE owner must supply a working HTTPS runtime, allow the exact FE origin in CORS, provide authorized test access and confirm SQL/readiness. WSS/realtime remains an owner/runtime dependency, not a result of this FE build. No real API login or SQL check was performed in this batch.

Normal `npm run build` retains normal auth and excludes the sample entry. Sample auth uses `racehorse.staging-auth.*.v1`, separate from API and dev-harness session keys. Sample markers are rejected before a real request. API errors never switch to sample data. A sample build routes unknown API paths to an explicit adapter error, never to the network. Sample reset affects only shared browser sample records. No developer toolbar, presenter page, test password or demo auth implementation is bundled in staging profiles.

`vercel.json` serves existing static files, rewrites extensionless application paths to `index.html`, and excludes `/api`, `/assets` and filename paths from the SPA fallback. Missing JS/API/`.env` must return 404, not HTML 200. Responses request no indexing and revalidation, plus `nosniff`/referrer headers. Actual Vercel routing is still a post-deployment smoke requirement; the local server is only a rehearsal of this configuration.

## Verification and limits

- Final Vitest author run: **477/477 tests, 44/44 files**, one worker, exit 0; separate Node build-policy suite **4/4**. Lint, typecheck, normal production build, sample/API staging builds and `git diff --check` passed. Both static profiles passed 15 deep-link checks plus entry asset and negative 404 checks. Local Node was 24.19.0. These results do not grant an Independent Gate.
- New tests cover seven role entries, shared Horse draft save, Interrupted evaluation preserving its terminal status, history navigation, Vet medical read, CM read-only Audit, forbidden access retaining identity, logout, marker/storage isolation, absent APIs and real-network errors without fallback. Node build-policy tests separately cover profiles, API origin constraints and output path safety.
- Browser rehearsal used production assets at `http://127.0.0.1:5196/login`: all seven workspaces, CM Dashboard/Audit and refresh, Horse draft/ownership, HT program wizard, Trainer evaluation submit preserving INTERRUPTED, Vet case/examination, Groom Audit denial/back-to-workspace, sign-out and reset. API artifact on 5197 showed real login and protected-route redirection; no credentials were submitted. The API build used `https://api.example.invalid` solely as a compile-time placeholder, not a working backend.
- Bounded accessibility/desktop check: named controls/labels, one sample-entry H1, Tab/Enter operation and visible shared focus ring, no document/main horizontal overflow on the observed 1280px Audit and 1440px workspace. This is not a full WCAG conformance or mobile audit. New browser tabs after the loading fix returned no warning/error entries in the observed checks. Feature modules still lazy-load behind explicit loading states.
- No secrets or real test credentials were added. No test was removed, timeout increased or assertion weakened. Initial full-suite discovery incorrectly included Node's separate test file; renaming it to `.check.mjs` keeps the four checks in `test:staging:build` and avoids executing them under Vitest.
- Actual logs, browser screenshot and exact committed HEAD are recorded outside the repository under workspace `.preview-local/official-fe-audit/staging-*`. These are author verification, not Independent Gate. CORE-033 historical `324d511` stays untouched. No DB, migration, merge or GitHub PR write was performed.

Release blockers for a shared **sample** URL: Leader publish approval, hosting/repository access and post-deployment checks. Full product gaps do not prevent an honestly labeled sample demonstration, but remain required CORE work. Roll back by selecting a previously verified Preview deployment or redeploying its reviewed revision; do not reset shared branches. Stop rollout on auth/sample crossover, leaked credentials, failing deep links/assets, unexpected backend mutations or blocking console errors.

## Project Tracking mapping and missing owner handoffs

Authority: `project-context/Racehorse_Core_Flow_Execution.xlsx`, SHA256 `90e8c9fb5814069bc84a62c12a2e6b5215668c138cc030f884320ed1b4e588a0`, Task Playbook and approved DEC-008/009/010. Tracking status below is the workbook value, not a claim about merged Git code. Direct Leader exception permits this staging-only sample role entry; CORE-008's normal-login prohibition on role selection stays intact. No tracker edits or new CORE IDs.

| CORE ID | Owner | Tracking Status | Dependency | Figma | UI Status | API Status | Test Evidence | Gate Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| CORE-002 | Hoàng; Long staging integration authorized | In Progress | None | Shell 74:370 / 74:366; existing DS reused | Static config, assets and lazy route packaging prepared | Build boundary only | Lint/typecheck/build, HTTP deep-link and desktop rehearsal | No new independent verdict | Owner review of hosting/config delta |
| CORE-008 | Hoàng; Long staging exception | To Do | 002/003 | Existing login 400:7 unchanged; sample entry is a directly approved staging utility | Real login retained; sample-only entry and storage isolated | No API fallback; live auth pending | Seven-role/forbidden/logout/storage tests; API login browser check | Pending independent review | Review isolation; obtain real runtime for CORE-009 |
| CORE-052 | Dũng in tracker; Đức remediation/Long integration exceptions | To Do | 002/003 | 308:4605 / 308:5271 | Existing CM Dashboard/Audit preserved | Canonical adapter; sample snapshots explicitly labeled; live unverified | Staging CM/Audit smoke; prior module tests retained | **Pending separate reviewer** | Reviewer handles Gate; no Done claim |
| CORE-025 | Hoàng | To Do | 002/005/006 | Dashboard 94:286; S1–S4 101:286…108:511; rider 108:301/422; states 147:5976,149:6422,150:6487,149:6100,149:6772 | Required Trainer dashboard, session wizard/comparison and detail states still missing; current workspace/handoff page is not this CORE | Contract does not prove REST runtime | No owner implementation/Gate evidence found | Unknown / not granted | Hoàng hands off exact branch/HEAD, contract evidence and state tests; integrate without rewriting |
| CORE-041 | Hoàng | To Do | 002/005 | Library 120:5086; drawer 124:5277/126:5297/127:5321/140:5824; editor 128:5342/131:5475/136:5613; program 78:288/79:288/80:423/96:286; adjustment 80:778/116:303/141:5774 | Templates, program detail/progress/history and adjustment UI missing; handoff pages retained | Approved contract; runtime unverified | No version/duplicate/archive/adjustment owner evidence found | Unknown / not granted | Obtain Hoàng's exact published handoff; preserve CORE-022 creation wizard and no-delete/versioning rules |

Fresh remote fetch retained FE `origin/dev=f7c290d100c77ba6d33cf781aed9102f73c8a1bc`. Remote branch-name checks for 025/041 and GitHub PR title searches for `CORE-025` / `CORE-041` returned no matches. This does not prove no local WIP exists. No message was sent to teammates. The known required gaps (baseline/timeline, 025/041 scheduling/program management, realtime, restriction/HT medical variants, Owner minimum workspace, registrations/users and notifications) remain detailed in `FE-COVERAGE-MATRIX.md`; seven-role entry does not satisfy full DEC-009 product coverage.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [static project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vite environment/modes](https://vite.dev/guide/env-and-mode).
