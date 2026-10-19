# Staging builds (official runtime)

Leader directive of 2026-10-18: Racehorse is a real product.
- The deployed application always uses the real API client.
- The sample business store is test-only, and no runtime build can reach or bundle it.
- Sample staging builds are retired. The previous sample Preview deployment (`fbfe47f` / `0b3aa42`) stays on Vercel only as a regression reference until a replacement is verified.

## Profiles (`RACEHORSE_STAGING_MODE`)

| Profile | Command | Behaviour |
|---|---|---|
| `preview` | `npm run build:staging:preview` | **Protected, non-production Preview only.** Real API client with a role test login for UI inspection before the Auth API is online. The seven test roles carry no password, no JWT and no server authority. Every API call made with a test identity fails with `503 SERVER_UNAVAILABLE` before reaching the network. Screens show that error; nothing is created, changed or saved. `VITE_API_BASE_URL` is optional and must be a public HTTPS origin if set. |
| `api` | `npm run build:staging:api` | Real login and real API calls. Requires `VITE_API_BASE_URL=https://<public-backend-origin>`. Rejects the role test login and every sample/harness flag. |

The normal `npm run build` is the production build:
- real login only
- no role test login, test identities or sample code

The build script fails if any profile's output contains:
- the sample store key
- sample adapter chunks
- the developer harness

It also fails if an `api` output contains the role test login or test identities.

## Release rules

- **Production** is built from `main` by Vercel with `npm run build` (see `docs/RELEASE-POLICY.md`, 19 October 2026). Staging profiles refuse to build Production.
- **Preview** builds accept the dedicated `preview/role-test-main` branch with full source pins, or the historical `integration/fe-product-main` branch. Neither is built as Production.
- Current `vercel.json` allows automatic deployments only from `main`; every Preview remains a manual, Leader-authorized deployment.
- Switching the existing Vercel Preview from `sample` to `preview` requires changing `RACEHORSE_STAGING_MODE` in the Vercel Preview environment. A build that still uses `sample` now fails on purpose.

## Protected Preview from a reviewed main snapshot

This is prepared tooling, not an applied Vercel configuration or deployment. The previous integration Preview is not evidence of the latest `main` UI. `main` remains the Production source and keeps the normal production build.

After the Leader approves the exact source and Preview configuration:

1. Fetch `origin/main` and record its full SHA. Prepare the dedicated **`preview/role-test-main`** branch from that reviewed main snapshot, including only the reviewed Preview tooling if it is not on main yet. Preserve the source-main SHA and record any changes above it. Do not merge older integration work into this branch.
2. Record the dedicated branch's exact reviewed HEAD. Set only for that branch in the **Preview** environment:

   ```text
   RACEHORSE_STAGING_MODE=preview
   RACEHORSE_PREVIEW_EXPECTED_SHA=<full lowercase reviewed Preview HEAD SHA>
   RACEHORSE_PREVIEW_MAIN_SHA=<full lowercase freshly fetched origin/main SHA>
   ```

   Expose Vercel Git/system metadata. Leave sample/harness flags disabled. Do not copy these settings to Production. `VITE_API_BASE_URL` remains optional for role-test inspection; test identities cannot call the server even when an API origin is set.
3. Use the separate **`vercel.preview.json`** template: `npm run build:staging:preview`, output **`dist-staging`**, automatic Git deployments disabled, and the same SPA rewrites/security headers. Merely changing the dashboard build command is insufficient because `vercel.json` overrides dashboard settings. Leave main's `vercel.json` unchanged. Use the Git-connected, Preview-branch-only preparation below after Leader approval; the CLI source-upload limitation is explicit. [Vercel configuration precedence](https://vercel.com/docs/project-configuration/vercel-json#buildcommand)
4. Keep the already approved Deployment Protection enabled for every Preview URL. Verify signed-out visitors are blocked and authorized reviewers can enter. The build script does not establish hosting access control, enable protection, or authorize deployment.
5. Verify the checkout contains the pinned main revision in its Git history. Missing/shallow history fails closed; make the pinned commit/history available before rebuilding. For hosted Preview, the source branch comes from `VERCEL_GIT_COMMIT_REF`, not the internal checkout label. Successful Git revision, branch and status probes are required. The actual Git SHA must equal both `VERCEL_GIT_COMMIT_SHA` and the full expected-SHA pin; the pinned main must be a verified ancestor and the working tree must be clean. Internal `master`, detached HEAD and matching checkout names follow exactly the same proof. No build script fetches or changes Git branches.
6. Inspect `staging-meta.json` after the authorized build: `revision` must equal the reviewed Preview HEAD, `sourceBranch` must equal `preview/role-test-main`, `sourceMainRevision` must equal the recorded main SHA, and `sourceKind` must equal `main-snapshot`. Metadata records a verified snapshot, not a claim that no newer main commit exists. Re-fetch/review and update both pins for every refresh; do not call an old snapshot "latest main".

The old integration branch remains a historical inspection route. Its metadata says `sourceKind=historical-integration`, `sourceMainRevision=null`. Main-source pins on that hosted branch are rejected. Its name or a successful build does not make it the current main source.

### Separate configuration and CLI limits

`vercel.preview.json` is additive; Vercel does not automatically select it for a Git deployment. The documented CLI syntax to select that file and explicitly target Preview is:

```bash
vercel deploy --local-config vercel.preview.json --target=preview
```

**Do not execute this command with the current remote-build source guard.** Vercel CLI supports `--local-config`, but it excludes `.git` from source uploads. Our build requires actual Git checkout/ancestry evidence and therefore fails closed on such an upload. The configuration-selection syntax is verified; this deployment path is **BLOCKED**, not deployment-ready. Do not ship `.git`, fabricate source metadata or weaken the source guard to bypass this limitation. [CLI local configuration](https://vercel.com/docs/cli/global-options#local-config), [deploy target](https://vercel.com/docs/cli/deploy#target), [CLI ignored files](https://vercel.com/docs/builds/build-features#ignored-files-and-folders)

Any future CLI route requires separate verification and Leader approval. It must use the existing approved project/team link; check the project/org identity in `.vercel/project.json` without printing credentials. Do not run an initial `vercel` command that creates or links another project. Never add `--prod`, promote a role-test deployment or change project-wide Production build/output settings.

### Recommended Git-connected manual Preview

This preparation has **not** been performed or authorized by adding the template:

1. Obtain explicit Leader approval for publishing the dedicated Preview branch, its configuration-only delta, the exact source-main/Preview SHAs, existing Vercel project and protected Preview target.
2. In a separate clean worktree on **`preview/role-test-main`**, copy the reviewed `vercel.preview.json` contents to that branch's `vercel.json`. Commit/publish only when authorized. Keep this configuration change on the Preview branch; never merge or promote it into `main` or `dev`. Record the final Preview SHA **after** this configuration commit and use it for `RACEHORSE_PREVIEW_EXPECTED_SHA`. Main's production configuration remains unchanged. The config-isolation Node test uses the actual branch for local and Production checks. In hosted Preview it uses deployment metadata only after verifying the same Git evidence, exact pins, main ancestry and clean tree as the build. An internal checkout label alone never permits Preview configuration.
3. On the existing Git-connected Vercel project, choose **Deployments → Create Deployment**, select the exact Preview Git revision and branch configuration, and verify the target is **Preview** before creating it. Preserve Deployment Protection and the two public build SHA pins. Manual Git-reference creation is supported even when automatic deployment is unavailable. [Manual Git-reference deployments](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference)
4. Verify Git history contains the pinned main ancestor before the build. Vercel documents a default shallow clone depth of ten; keep the Preview configuration delta close to the pinned source, or arrange the required history with approved tooling. A missing ancestor remains a build blocker. No script fetches history or bypasses the ancestry check. [Vercel build source/history](https://vercel.com/docs/builds)
5. Confirm build command/output, protection, branch/SHA and `staging-meta.json`. Test the seven-role UI and expected server-unavailable states. A local hosted-context rehearsal proves policy/build behavior only; it does not prove Vercel protection, successful deployment or live backend integration.

### Local rehearsal without changing checkout

Leave Vercel deployment metadata unset. Set the two public SHA pins to the current reviewed local HEAD and its fetched main ancestor, then run `npm run build:staging:preview`. The same source/ancestry checks run, but metadata records the **actual local branch**, not the proposed hosted branch. Local WIP is permitted and recorded as `workingTreeDirty=true`; that artifact is rehearsal evidence, not a clean reviewed release. The dedicated hosted Preview rejects dirty checkouts. Missing or mismatched pins reject a pinned rehearsal before compilation. An ordinary unpinned local build remains available and reports `sourceKind=local`.

The focused build-policy check is `node --test scripts/staging-policy.check.mjs`. It covers synthetic/matching/detached checkout labels, source pins, actual Git/hosting SHA mismatch, invalid branch metadata, missing Git proof, unknown/dirty worktree state, ancestry rejection, local rehearsal, historical provenance, exact branch-specific hosting configuration and Production rejection. Role-test runtime and no-network checks remain in `src/staging/roleTestLogin.test.tsx` and `src/staging/sessionBoundary.test.ts`. No runtime authentication or API fallback changes are needed for this source-policy update.

## Local checks

```bash
npm run build:staging:preview
```

```bash
node scripts/serve-staging.mjs dist-staging-preview 5196
```

```bash
npm run test:staging:build
```

The UI checks for the role test login are in `src/staging/roleTestLogin.test.tsx`:
- seven roles
- no network calls
- 503 on API use
- no sample store
- RBAC and sign-out

## What is still not proven

Backend authentication, RBAC, SQL Server persistence and real business transactions are **NOT VERIFIED** until the backend staging API is online and the API profile is tested against it.

## First hosted main-source Preview attempt (19 October 2026)

The Leader-authorized manual Git Preview at `7351106e7d5f621579194bac85820ba0e27baca5` failed before compilation. Deployment `CGYN3HdQ8H2W2Y8b4q2NaekiNtUL` used `npm run build:staging:preview` and reported `Vercel Preview branch does not match the actual Git checkout.` The actual checkout SHA passed its preceding equality check, but the log did not record the checkout branch name. No hosted seven-role PASS or working Preview URL is claimed.

The approved diagnostic at `d299f3c761e7e0d6107a3a962dc00338bbb33ab0` confirmed `hosting="preview/role-test-main", checkout="master"` in deployment `9qZBysauP8HDbwCVUhN2DjWtFja7`. Its preceding actual-SHA check passed. This established that equality of the internal checkout label and hosting source branch was an invalid assumption.

On 20 October the Leader approved the compatibility correction: use validated deployment branch metadata and independently verify the actual Git revision, exact pins, main ancestry and clean tree. The runner now explicitly records whether all Git probes succeeded; missing proof or unknown worktree state fails closed. This changes only Preview provenance handling, not Production, role-test authority, runtime data or access protection. A new exact SHA still requires Leader approval before changing Vercel's branch-scoped expected-SHA variable and creating another manual Preview. No deployment is authorized by this code change.
