# rc1 Production preparation — 19 October 2026

Candidate: release PR [#18](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/pull/18), source `c2bdc96df360b86a1a1d0fe4224d3a36a1ae4fba`, plus the isolated `fix/fe-release-production-readiness` patch containing this document. No main/dev merge, deployment, database operation or dashboard modification was performed.

## Source and corrections

- `main`: `6041b0a694e404f51c75de3eef76bd9c7cebad28`; still an ancestor of release.
- PR #18 remains OPEN/Ready, MERGEABLE but BLOCKED/REVIEW_REQUIRED. Reviews, review threads and status-check rollup were empty when read. Effective main rules require one approval, approval of the latest push, stale-review dismissal, resolved conversations and merge commits; force pushes/deletions are blocked. Absent CI is not a checks PASS.
- Integration `9fb747d` and source heads `a46f80d`, `15ca082`, `c6aec40`, `34e2f96`, `e2a7d8a` all remain ancestors. Original contributor history is retained; no squash, rebase or fabricated co-author was used. Do not repeat the integrated feature PRs.
- Fixed the real Production default that sent REST and WebSocket traffic to a visitor's localhost. An unset origin now uses same-origin `/api` and `/ws`; a configured Production origin must be public HTTPS, without credentials/path/query/fragment. Local Vite development retains its localhost default. The build validates environment configuration before compilation, and the bundle checker additionally rejects the old localhost origins.
- Same-origin routing does not provide a Backend. With no Backend connected, requests fail honestly and no session, mock mutation or sample fallback is created.
- Configuration docs now distinguish the current main build policy from historical staging policy. Required UI gaps and canonical owners are in [RELEASE-RC1-UI-GAPS.md](RELEASE-RC1-UI-GAPS.md).

## Verification actually executed

Windows Node `24.19.0`; locked install through npm CLI (`ci --no-audit --no-fund`): 237 packages. Direct Node invocations of the checked-in lint/typecheck/test/build scripts avoid Windows shell interpretation of the ampersand in the workspace path. No dependency versions changed. Lockfile SHA-256: `c0a37c1d58aca45553ee6686c39c2b7dbbfd1f9c2156c55ca6e1ce6c53e9011c`.

| Check | Result / limits |
|---|---|
| ESLint and TypeScript `tsc -b --noEmit` | PASS |
| Complete Vitest suite, one worker | Final run **841/841**, 66 files, 156.84 s. Initial run **840/841**: Program Creation's long workspace-to-create/readback test exceeded 5 s. The same unmodified test passed at 1.4 s in isolation and in the final complete run. No timeout, assertion or test was weakened; timing sensitivity remains recorded. |
| Program Creation + Audit focused repetition | **55/55** (17 + 38). Audit also passed in both full runs. |
| Staging policy | **7/7** Node checks |
| Production build | `tsc -b`, `vite build`, `check-production-bundle.mjs`: PASS, `PRODUCTION_BUNDLE_OK`. 27 JS chunks; no sample/test-role/dev chunk or old localhost origin. |
| Negative configuration build | `VITE_API_BASE_URL=http://localhost:8080` rejected before compilation; 17 URL-policy unit cases cover empty/same-origin, valid HTTPS and unsafe inputs. |
| Literal credential-pattern scan | No private-key, GitHub-token or AWS-key marker in JS assets. This is a bounded pattern scan, not an exhaustive security audit. |
| Static HTTP rehearsal of actual `dist` | **16** deep links returned the identical SPA shell; seven entry assets loaded; `/api/health`, missing assets, `/.env`, `/package.json`, `/staging-meta.json` returned 404 rather than false-success HTML. |
| Browser on actual `dist`, loopback 5203 | Landing → Login; protected Horse deep link → Login; refresh; Back/Forward: PASS. Synthetic invalid sign-in failed visibly against the same-origin static server; no sample workspace appeared. Landing console read showed no warnings/errors. |
| Seven-role boundaries / journeys | Covered by the executed fixture suite: canonical auth workspaces for all seven roles and affected Horse/Training/Medical/router tests. These use HTTP/service fixtures, not Backend/SQL. Claude's earlier 53-route browser fixture evidence is historical and was not rerun as 53 browser routes in this patch. |
| Diff whitespace | PASS |

Initial dependency installation and the first test launch were affected by the Windows sandbox; installation/test execution succeeded outside that sandbox in this isolated worktree. The initial bundle check caught a retained development localhost literal in the new helper; it was corrected before the successful final build. React `act(...)` and hydration warnings remain in existing fixture tests; they are not evidence of a Production browser crash. No real Backend/SQL E2E or Independent Gate is claimed.

Private machine evidence, intentionally not committed: `.preview-local/official-fe-audit/release-readiness-{full-suite,full-suite-final,focused,http}.json`, Production Landing/Login screenshots, `release-vercel-production-blocker.png`, `release-vercel-no-production.png` in the task workspace root.

## Live Vercel findings (read-only)

Project: [racehorse-official-fe](https://vercel.com/lamphilong2004s-projects/racehorse-official-fe), Hobby team `lamphilong2004's projects`, connected to the official FE repo. Production Branch **main**, root field empty (repository root), Node **24.x**. Production has **no project environment variables**. Vercel Authentication is enabled with **Standard Protection**; no protection was weakened. Production custom-domain auto-assignment is currently enabled.

The dashboard explicitly says **No Production Deployment / Your Production Domain is not serving traffic**. Its old integration Preview is Ready (`EPuzkS2WTMahterJz7avopnjkjuJ`); that is not this release or real API proof. No new public Production URL is verified by this batch.

**Confirmed launch blocker:** Ignored Build Step is **Only build pre-production**, command `if [ "$VERCEL_ENV" == "preview" ]; then exit 1; else exit 0; fi`. Exit 0 skips Production, per [Vercel's Ignored Build Step documentation](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel).

The dashboard still displays legacy `npm run build:staging` / `dist-staging` overrides. The release's checked-in `vercel.json` specifies `npm run build` / `dist` / `npm ci`; [Vercel documents](https://vercel.com/docs/project-configuration/vercel-json) that these per-deployment settings override the dashboard. Aligning the dashboard is cleanup, separate from the confirmed ignore-command blocker.

## Minimum Leader-controlled launch steps

1. Review this fix on its own branch/PR into `release/fe-main-rc1`; retain a merge commit. Re-fetch PR #18 afterward because its reviewed HEAD/evidence will change. Do not merge main automatically.
2. Before enabling Production, obtain Leader authorization for the concrete reviewed release and Vercel changes. Settings → Build and Deployment → Ignored Build Step → **Automatic** → Save. Align Build Command to **npm run build**, Output Directory to **dist**, Install Command to **npm ci** (or remove obsolete overrides). Keep root, Node, repo and Production Branch unchanged. No paid setting is needed.
3. Production environment: keep all sample/presenter/test-role flags and secrets absent. Without an approved HTTPS Backend origin, release only the honest FE shell with unavailable login/business operations; do not configure localhost. Add only the public `VITE_API_BASE_URL=https://…` after a real Backend is approved. No BE work is authorized by this handoff.
4. Leader obtains the required independent latest-push approval and explicitly authorizes PR #18 → main with **Create a merge commit**. Since current source allows automatic deployment only from main, changing the ignore rule plus merging main enables Production and auto-assignment; this must be one deliberate approved release window.
5. Verify the resulting exact main merge SHA in Vercel, build log/checker, deployment Ready and actual public Landing/Login/deep-link/assets in a hosted browser. Report the real URL only then. Until the API is configured, mark live login/SQL E2E unavailable rather than PASS.
6. If the first deployment fails, leave it unpromoted and preserve evidence. There is no existing Production deployment to roll back to. Do not reset main; any source correction uses a reviewed PR. Reinstating the prior ignore rule prevents future automatic builds but does not remove an already exposed deployment; any hosting rollback/unpublish needs Leader authorization.
