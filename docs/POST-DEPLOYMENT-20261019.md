# Post-deployment checkpoint

## Final verification for PR20 readiness

The final shared-code revision is `112d56c68a58ff329f3c340c4ea64906ea4ccbc8`. It fixes the v2 keyboard outline being overridden by legacy field focus specificity, without changing v1 or weakening an assertion. Subsequent checkpoint/adoption-guide updates change documentation only.

- **Full regression PASS in one uninterrupted run after the focus fix:**69/69 files,862/862 tests, exit0, no worker-start/unhandled error. Command: `vitest run --pool=threads --maxWorkers=1 --no-file-parallelism --isolate`. Per-file isolation, assertions and default timeouts remain intact. A separate complete run before the focus fix also passed; the earlier partial forks run remains historical below.
- Lint, typecheck, Production build and bundle isolation,18/18 Node policies (13 staging/configuration +5 foundation), and diff check PASS. The Production artifact contains no DEV foundation title/route, role-test sign-in, test emails or sample store.
- Isolated local Chromium:11 checks PASS across1440x900,1280x800,1024x768,768x1024 and375x812. Grid3/3/2/2/1, no horizontal document overflow, bounded modal/drawer and guard actions, dirty input preservation, keyboard tab selection/focus, duplicate-toast suppression and reduced-motion skeleton/spinner PASS. Legacy gallery retains #2f6dd9/#f7f8fa and no v2 scope. No API request or page error occurred. This is shared-foundation coverage, not certification of every feature screen or mobile AppShell.
- Exact clean local Preview candidate: `preview/role-test-main` at `7351106e7d5f621579194bac85820ba0e27baca5`, source-main `bfa814776d16e2b7cb054e5600714cd6382e1662`. Its src/scripts match the final tested shared-code revision. It adds only Preview-specific hosting configuration beyond that source and retains all authored history. Hosted-context build and13/13 configuration checks PASS; actual output is `dist-staging`, metadata records both exact pins and `workingTreeDirty=false`. This replaces the initial1a792b4 local candidate below. The branch remains local/unpublished; no hosted deployment was created.

### Exact Vercel proposal awaiting Leader approval

Existing project/team: `racehorse-official-fe` / `lamphilong2004s-projects`, Hobby. Publish the dedicated Preview branch only after approval, then create one manual **Preview** Git deployment at the exact SHA above. Add only these public config variables, scoped to **Preview + preview/role-test-main**:

| Variable | Value |
|---|---|
| `RACEHORSE_STAGING_MODE` | `preview` |
| `RACEHORSE_PREVIEW_EXPECTED_SHA` | `7351106e7d5f621579194bac85820ba0e27baca5` |
| `RACEHORSE_PREVIEW_MAIN_SHA` | `bfa814776d16e2b7cb054e5600714cd6382e1662` |

The branch-only vercel.json selects `npm run build:staging:preview`, output `dist-staging`, automatic deployment=false, and unchanged rewrites/headers. Keep API origin unset for UI inspection; the build runner supplies API-only transport and the non-authoritative role-test flag. No sample flags, credentials, localhost origin or fake success.

Read-only live dashboard verification: Vite, root repository directory, Node24.x, npm ci; Production tracks main with npm run build/dist, Auto-Assign Domains enabled, primary domain `racehorse-training-management.vercel.app`, no Production env variables listed. Preview Branch Tracking is disabled, no custom domain is attached, and system-variable exposure is enabled. Existing RACEHORSE_STAGING_MODE belongs only to historical integration/fe-product-main. Vercel Require Log In / Standard Protection remains enabled. Preserve every setting above; do not change project-wide build overrides, Production, current domains, protection or old integration variables.

The new URL is UNKNOWN until deployment; use its generated protected Preview URL only. Do not attach Production domains, create bypass/share links or assume additional reviewer memberships. After approval, verify exact Git/metadata, signed-out denial, authorized seven-role entry, unavailable API states, no Backend requests/writes, refresh/deep links and unchanged Production. Missing Git history or protection failure stops sharing; do not fabricate metadata or relax guards. If needed, roll back only the newly approved Preview and its branch-scoped overrides. No current cloud mutation, paid resource, Backend/SQL work, CORE-050 implementation or cross-owner screen migration is performed.

Final evidence outside Git: `v2-final-after-focus-full-suite.json`, `v2-final-browser-results.json`, five viewport screenshots and `v2-preview-approval.json` under workspace `.preview-local/official-fe-audit/`. Hosted Preview and independent GitHub approval remain pending. Existing React act/HydrateFallback warnings remain; they are not failed assertions or a new page error.

## Initial checkpoint — historical evidence

## Source and Production

Base: `main` at `bfa814776d16e2b7cb054e5600714cd6382e1662`, PR18 merged. Existing Vercel Production deployment `8TM6d3TVNRLGVgUaoENoZRhMFJ5m` is Ready from that exact main revision at <https://project-m15tb.vercel.app/>. No cloud configuration or deployment was changed.

Shared source patch: `781276332a4d9ec627d47b02814a96303a071a45` on `feat/long-fe-v2-foundation`. This adds the opt-in foundation, safe Preview provenance/configuration tooling, common login error clarification and updated required-screen inventory. Production remains on the base, not this patch.

Static HTTPS smoke passed 16 SPA documents and 82 reachable assets, including 46 font files. Missing assets, `.env` and `package.json` return404. Landing/Login render; Login refresh and an anonymous Horse detail deep link return the appropriate SPA/Login UI. Computed body font is Inter. Bundles contain no role-test entry, sample store or developer harness and no legacy localhost REST/WebSocket default. REST/socket origins derive from the validated API origin or the current HTTPS origin.

Two explicitly labelled simulated product illustrations remain on Landing. These are static illustrations, not a runtime sample store or business records. No production test account or role selector was observed. Production `/api/health` is404 and does not prove a Backend. An invalid synthetic login remains signed out and reports an unreadable response. The candidate clarifies non-JSON static-host/gateway login failures as **Sign-in service is unavailable**; the local production artifact verifies this message. This fix is not deployed.

## Seven-role Preview

Prepared **local-only** branch `preview/role-test-main`, HEAD `1a792b4f3ebc9febb05f488372c06455df200041`, contains the source patch above and one `vercel.json` configuration-only commit. It descends from the exact main base. Only that branch selects the role-test build; automatic Git deployments are false. Do not promote its Preview configuration into main/dev. The branch has not been published or deployed.

A clean hosted-context rehearsal verified actual checkout SHA, hosting SHA, branch and main ancestry. `staging-meta.json` reports `sourceKind=main-snapshot`, `workingTreeDirty=false`, the exact Preview SHA and source-main SHA. Normal Production and API-staging artifacts exclude role-test/sample/dev-gallery chunks. API isolation used `https://api.example.test` for compilation only; this is not a deployed or tested Backend.

Local static-host smoke passes15 deep links. Browser inspection opens all seven workspaces, signs out and switches roles. Club Manager Dashboard/Audit/Horse List, Create Program horse selection, Trainer sessions/programs, Rider rides, Medical Cases, Groom tasks and Owner horses show unavailable states when data is required. Horse submit rejects with **The horse was not saved**, retains input and never reports a fake write. Groom direct `/medical` is denied. No browser console error was observed in this Preview session. Fixtures also verify test identities never reach fetch and have no server authority. This does not verify live RBAC or database persistence.

Local review URLs while the processes run:

- `http://127.0.0.1:5206/login`: seven-role UI inspection, no server authority.
- `http://127.0.0.1:5204/dev/foundation-v2`: DEV-only common component review.
- `http://127.0.0.1:5205/login`: candidate Production artifact, real API behavior with unavailable local Backend.

Vercel project read-only inspection confirms **Require Log In enabled / Standard Protection**. The existing historical integration Preview returns302 to vercel.com for a signed-out request; it is not the new main-source artifact. The new Preview needs Leader approval to publish its branch, set Preview-scoped pins, and manually create the protected Git-connected deployment. Its signed-out/authorized hosted behavior must then be checked. CLI source upload is blocked by the required Git ancestry evidence because `.git` is excluded; do not bypass that guard. Exact instructions are in `STAGING.md`.

## Shared foundation and required UI

See `DESIGN-SYSTEM-V2-FOUNDATION.md` for backward-compatible adoption. V1 stays default. The foundation covers scoped color/typography/motion, buttons and form states, cards/tables/badges/tabs, bounded overlays, controlled toast/skeleton and memory-only unsaved-change guards. No owner feature screen is migrated automatically. Existing AppShell is still desktop-first. CSS bounds/reduced-motion checks are not a complete mobile browser or WCAG certification.

The refreshed `RELEASE-RC1-UI-GAPS.md` maps exact Figma nodes to routes/owners. Hoang retains CORE-022 Program List, CORE-041 templates/program detail/progress/history, CORE-054 notifications and related monitoring/restriction gaps. Duc retains CORE-036 Injury 3D gap. CORE-050 is Dung's tracker task but current FE assignment is unverified; Long must assign it before implementation. No missing owner screen was implemented or CORE marked Done.

## Verification and limitations

- Lint, TypeScript, Production build, production bundle isolation and diff check: PASS.
- Node policy tests:17/17 (13 staging/configuration plus4 foundation). Dedicated Preview branch configuration:13/13.
- Vitest first run:65 files,826 tests passed, but command exited1 with four worker-start errors (`UNKNOWN` read/spawn; one process exit3221226505). Its JSON success flag alone is not a whole-command PASS.
- Only the four omitted files were rerun serially:36/36 PASS. Combined,69 unique source test files and862 tests executed, no overlap or failed assertion. No tests, assertions or timeouts were weakened. No claim of a single uninterrupted green full run is made.
- Focused additions cover pending controls, dirty overlays, toast deduplication, unsaved navigation/Back/auth redirect/unload and unavailable Auth API errors. The browser confirms scope colors, 40px controls, retained input, Escape/focus behavior, deduplicated feedback and data states at1280x720. Existing development-router HydrateFallback warnings remain; no new console error was observed.

Sanitized local evidence is outside Git under workspace `.preview-local/official-fe-audit/`: `post-deploy-production-http.json`, `v2-foundation-full-suite.json`, `v2-foundation-worker-retry.json`, `v2-browser-checkpoint.json` and associated screenshots. Evidence contains no credentials/JWT/cookies. Backend/SQL integration, hosted seven-role Preview and adoption across owner feature screens remain unverified. No Backend, SQL, main/dev merge or new deployment occurred.
