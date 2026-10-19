# Leader release policy

## Current policy — 19 October 2026 (supersedes the Vercel sections below)

Leader decision: `main` holds the complete Frontend for the three Main Flows and Vercel Production builds only from `main`.

- `vercel.json`: framework Vite, install `npm ci`, build `npm run build`, output `dist`, SPA deep-link rewrite to `/index.html`, and `git.deploymentEnabled = { "main": true, "**": false }`, so only `main` deploys automatically. Older revisions keep their own `vercel.json` (`deploymentEnabled=false`) and do not deploy.
- `npm run build` runs `scripts/check-production-bundle.mjs`, which fails the build if the bundle contains the sample store, developer harness, role-test sign-in or test identities. JWT/RBAC remain enforced by the real API client.
- The per-commit `RACEHORSE_APPROVED_RELEASE_SHA` interlock is retired. The staging scripts (`build:staging:*`) are local/manual tooling only and refuse to build Production.
- Vercel project settings to keep in the dashboard: connected repository `lamphilong2004/SWP391_Racehorse-Training-Management-System_FE`, Production Branch `main`, Root Directory `.`, no Ignored Build Step that skips Production, no duplicate project.
- Backend is not connected in this phase. `VITE_API_BASE_URL` (public HTTPS origin only, never a secret) is set in Vercel when the Backend goes online.
- Without an API origin the production shell requests same-origin `/api` and `/ws`; no localhost default or sample fallback is used. Static hosting alone does not implement those endpoints: login and business operations remain unavailable until a real Backend is connected. A production build rejects configured HTTP, local/private, credential-bearing or path/query-bearing API origins.
- PR #18 is now merged. Production was verified Ready from `main` at `bfa814776d16e2b7cb054e5600714cd6382e1662`, at `https://project-m15tb.vercel.app`. This records the existing deployment, not approval to merge or deploy subsequent changes. Its static shell is available; Backend authentication and database integration remain unavailable on this deployment.
- A new main-source role-test Preview may be prepared on `preview/role-test-main` with verified source pins and its branch-only configuration. See `docs/STAGING.md`. Deployment and any Vercel environment/protection change still require Leader approval. This Preview configuration must never be promoted into `main` or `dev`.

---

## Previous policy — 18 October 2026

Authority: direct Leader decision in this session. Project Tracking remains authoritative for CORE ownership/lifecycle; no status, Gate or business/Figma decision is changed here.

| Branch | Purpose | May receive current Gate Pending work? | Hosting target |
|---|---|---|---|
| Individual feature branches | CORE development with original authors and PR evidence | Development only | No release |
| `integration/fe-product-main` | Fast-Track integration and Preview testing | Yes, explicitly identified as pending | Protected Preview only |
| `dev` | Independently accepted integration | **No** | No automatic deployment in this configuration |
| `main` | Official reviewed release; existing GitHub default | **No** | Production, only after explicit Leader authorization |

## Verified state and remaining access

Live GitHub read: default branch `main`, HEAD `6041b0a694e404f51c75de3eef76bd9c7cebad28`; `dev` HEAD `f7c290d100c77ba6d33cf781aed9102f73c8a1bc`. Both branch responses say `protected: false` and protection `enabled: false`; repository rulesets returned `[]`. Detailed `/branches/main/protection` and `/branches/dev/protection` reads each returned **403 Resource not accessible by integration**. No administration/write retry was made. An administrator must verify and establish enforcement before release; these observations do not constitute protection PASS.

Vercel dashboard inspection redirected to **Log in to Vercel**. This checkout has no `.vercel/project.json`. Therefore actual linked project, Production Branch, Deployment Protection, auto-domain assignment, environment scopes, Production API origin/credentials and deployment policies are **UNVERIFIED**. No credential values were read or printed, and no cloud setting was changed. GitHub's default branch alone does not prove Vercel's actual Production Branch.

## Prepared repository controls

- `vercel.json`: `git.deploymentEnabled=false` prevents automatic Git-triggered deployments when this configuration is used. No paid protection, domain or service was provisioned. It cannot alter settings or deployments from older revisions already in Vercel.
- The configured `npm run build:staging` fails early for Preview source metadata other than `integration/fe-product-main`.
- Vercel Production builds require `RACEHORSE_STAGING_MODE=api`, `VERCEL_GIT_COMMIT_REF=main` and `RACEHORSE_APPROVED_RELEASE_SHA` equal to the full `VERCEL_GIT_COMMIT_SHA`. Sample mode, missing/mismatched approval, non-main source, sample/harness flags and known placeholder API domains are rejected. The SHA approval value is public metadata, **not a secret**. Leave it unset until the Leader authorizes that exact release.
- This is an accidental-deployment interlock, not an Independent Gate, proof of backend credentials, or an authorization system. Administrators must preserve the build command and enforce real Git/hosting controls. A local build without Vercel metadata remains available for development and produces no deployment.
- Role-test/API session isolation and no-fallback behavior are enforced; the sample business store is test-only and never in a runtime build. No production password, JWT secret, SQL string, bootstrap account or test password belongs in any `VITE_*` variable. Real secrets remain on the BE; only the public HTTPS backend origin belongs in the FE build.

## Protected Preview preparation — first target

These are the settings to apply **after approved dashboard access and Preview publish authorization**, not settings already applied:

1. Link the official FE repo to the intended Vercel project/team without launching an initial Production deploy. Root `.`, Node 24.x, install `npm ci`, build `npm run build:staging`, output `dist-staging`. Do not create a duplicate demo app.
2. Settings → Environments → Production → Branch Tracking: set **`main`**. Disable **Auto-assign Custom Production Domains** so a later authorized Production build can be inspected before promotion. Keep Git automatic deployment disabled during preparation.
3. Settings → Deployment Protection: enable **Vercel Authentication**, with protection covering all Preview/deployment URLs (Standard Protection or a stronger already-approved scope). Verify signed-out visitors cannot see sample data and authorized reviewers can. Do not buy Password Protection, disable protection for scripts, create bypass tokens, or treat `X-Robots-Tag` as access control.
4. In **Preview**, scope `RACEHORSE_STAGING_MODE=preview` (role test login, no server authority) or `api` (real backend origin) specifically to `integration/fe-product-main`. `sample` is retired and fails the build. Expose Vercel Git/system metadata to the build. Keep Preview settings out of **Production**.
5. Explicitly create a **Preview** deployment from the exact reviewed integration Git revision. Confirm target, source branch/SHA, protection and `staging-meta.json` before sharing. If enabling automatic Preview updates later is approved, replace `deploymentEnabled=false` with `{ "*": false, "integration/fe-product-main": true, "main": false }`; the true integration rule wins over the wildcard per Vercel's matching rules. Do not make that change now.
6. Run static deep-link/asset smoke and authorized-browser seven-role/CM Audit/Horse/Training/Medical checks. A protected URL may deny the unauthenticated HTTP smoke script: record that limitation and use the authorized browser without weakening protection. Test-role actions must end in an explicit server-unavailable error, never a fake success. Do not call this live API/SQL integration or full CORE completion.

## Promotion of a reviewed release to main

1. **Prepare accepted dev history.** Review every candidate CORE on its exact feature HEAD and the current dev base. Resolve all required changes, checks, contract/runtime/RBAC and real integration requirements. Merge only Gate-accepted feature PRs to `dev` using **Create a merge commit**. Do not merge this whole Gate Pending integration branch. Retain original feature commits and PR URLs; no force push, author rewriting, fabricated co-authors, squash of distinct contributors, or rebase rewriting published history. Do not enable a linear-history requirement that would prohibit the chosen merge-commit workflow.
2. **Freeze release evidence.** Record accepted `dev` SHA, current `main` SHA, CORE → owner → feature SHA → PR → Gate → dev merge SHA, environment prerequisites and limitations. Check for any pending/rejected CORE in the candidate's history/diff. Preserve published snapshots and evidence even when excluded from the release.
3. **Verify combined release.** Test the accepted dev candidate with current main in an isolated worktree. Run lint, typecheck, full tests, build-policy checks, API build and required backend/SQL smoke with authorized access. Recheck seven-role auth, 401/inactive logout vs role denial, CORS/HTTPS, real mutations, audit and relevant WSS. Fixture success is insufficient. Inspect public bundles for sample entry, presenter tools and credentials. No backend/test credentials are currently verified by this preparation batch.
4. **Protect review.** An administrator configures main/dev PR-only changes, independent review plus Leader final review, dismissal of stale approvals/approval of the latest push, required conversation resolution, and actual named CI checks once available. Require up-to-date review/testing, block force pushes/deletions and uncontrolled admin bypass; restrict main merges to the authorized release role. Do not invent check names or treat absent CI as PASS. Validate effective rules with admin evidence before release.
5. **Release PR `dev` → `main`.** Attach the frozen evidence and CORE/source ledger. Reconfirm PR HEAD/base immediately before merging; if either changed, rerun the affected checks and review. Leader merges with a merge commit only when every included CORE is accepted. A Git merge is not permission to deploy Production. Automatic deployment stays disabled.
6. **Authorize exact Production revision.** Read the resulting main merge SHA. Obtain explicit Leader authorization to build/deploy that SHA. Then configure **Production** only: `RACEHORSE_STAGING_MODE=api`, real `VITE_API_BASE_URL=https://<approved-backend-origin>`, `VITE_BUSINESS_DATA_SOURCE=api`, `VITE_STAGING_SAMPLE=false`, `VITE_DEMO_UI_ONLY=false`, and `RACEHORSE_APPROVED_RELEASE_SHA=<that exact main SHA>`. Verify scope/presence without displaying secret values. BE owner confirms runtime, SQL readiness, exact production CORS origin and authorized test access. Rebuild using Production variables; never promote an integration/sample Preview.
7. **Stage then promote the authorized main build.** Create a Production-target build from that exact main revision with auto-domain assignment disabled. Verify protected deployment URL, source SHA/profile/API isolation and release smoke. Compare the final evidence with Leader authorization before assigning Production domains via Promote. This final action is forbidden in the present session without separate explicit authorization. Record deployment ID/URL, main SHA, API origin and checks.
8. **Post-release and rollback.** Check login/restore/logout, all seven role boundaries, required journeys and real API/SQL evidence; inspect console/network and backend logs. On auth/sample crossover, secrets, data-loss/business/RBAC failure or broken assets/deep links, stop promotion or use the previously verified Production deployment rollback. Preserve Git history and revert via reviewed PR if source correction is needed. Do not reset main or mark CORE Done solely because a deployment is green.

## Attribution evidence already preserved

Git ancestry at the integration checkpoint contains CORE-033 `324d51126745ae1f8d9121d939ff93076c004cdb` (author Plong04), CORE-036 `51525af2065041d336ec52d6f6b6d0329e8106c9` and CORE-046 `228e6d5fa8042cf60c92bc655497be07be78f7c8` (author minhduc1204). Original evidence includes [CORE-036 PR #8](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/pull/8) and [CORE-046 PR #5](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/pull/5). Legacy CORE-036 PR #2 remains excluded.

CORE-052 source `786d39713ed050e890503d7aaf600f5d949e9ff2` is authored by **minhduc1204**, but is **not an ancestor** of this integration HEAD: integration commit `e098202` imported its feature files and added integration wiring. Do not describe that snapshot import as preserving the source commit in ancestry or as Long authoring Đức's feature. Keep source credit and the original branch/commit; after its independent Gate, the accepted-dev release process must retain the original authored commits through the source PR/merge and separately review integration adaptations. No history or authorship is rewritten here. CORE-052 Gate remains pending.

## Tracking mapping for this batch

Author verification for this policy delta: **8/8 Node policy checks**, **20/20 focused staging/auth regressions**, full-project lint, type compilation in each sample/API build, both Preview-context builds with bundle isolation checks, and diff check passed. Production was not built/deployed; its rejection conditions were tested with fixture environment metadata only. The earlier 477-test full-suite result is historical and was not rerun for this build-script/documentation change. No Independent Gate is claimed.

Authority workbook SHA256 remains `90e8c9fb5814069bc84a62c12a2e6b5215668c138cc030f884320ed1b4e588a0`; direct Leader exception authorizes Long's staging/release preparation. Existing `STAGING.md` retains the broader CORE-025/041/052 inventory.

| CORE ID | Owner | Tracking Status | Dependency | Figma | UI Status | API Status | Test Evidence | Gate Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| CORE-002 | Hoàng; Long release preparation exception | In Progress | None | Existing shell/DS unchanged | No feature UI changed | Hosting/build policy only | Node policy checks, lint, sample/API builds | No new independent verdict | Admin verifies Git/Vercel controls, then protected Preview approval |
| CORE-008 | Hoàng; Long staging exception | To Do | CORE-002/003 | 400:7 unchanged | Existing normal/sample entries retained | API/sample isolation retained; Production credentials/live auth unverified | Focused auth/staging regression checks | No new independent verdict | Separate runtime verification before release; retain real auth |

Primary references: [Vercel branch tracking](https://vercel.com/docs/git#production-branch), [Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration), [Deployment Protection](https://vercel.com/docs/deployment-protection), [staged Production promotion](https://vercel.com/docs/deployments/promoting-a-deployment), [GitHub merge methods](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github).
