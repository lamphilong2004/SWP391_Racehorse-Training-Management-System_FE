# FE candidate for main — 2026-11-02

This report records the local UI candidate requested for re-verification and publication. It does not certify every business flow or authorize bypassing GitHub reviews.

## Source and history

- Remote main inspected: `5a26f420418ec7072c0be3406b9ad9797aba36eb`.
- Existing candidate branch: `feat/flow4-local-review`, starting HEAD `d47acf9002fb445576335c313847b4856eb65fbe`.
- Main is an ancestor of this candidate. Existing authored commits `b3738ee`, `ab32849`, and `d47acf9` are retained; no squash, reset, branch deletion or history rewriting.
- Local WIP was archived before staging. Credentials, runtime configuration, screenshots and database artifacts remain outside the repository.

## Scope

- Shared buttons, outlined task actions, tables, fields, overlays, focus return, reduced motion, notification badge containment and responsive layout.
- Public equestrian landing and bundled decorative horse image; no business data or credentials on the landing page.
- Input conveniences with explicit custom text alternatives, server-backed horse selection, Trainer assignment guidance and preserved form values on API failure.
- Owner wording separates DRAFT/INACTIVE lifecycle from the stored training-availability value.
- Previously developed Flow 4 routes and API client, using real authenticated requests. No sample store or fabricated write success.
- No Backend, SQL configuration, schema, database, cloud deployment or Flow 5 implementation change in this FE batch.

## Verification status

| Check | Current result |
|---|---|
| Full FE test suite, one worker | Initial run: 962 PASS / 111 FAIL in 9 files because personal same-origin API configuration leaked into HTTP fixtures. Re-run with the fixture origin: 153/153 PASS in those 9 files. Final full run with test-environment isolation: 1072 PASS / 1 FAIL across 96 files; the GROOM registry-read case timed out at the unchanged 20-second limit. This is not a clean full-suite PASS. |
| Isolated recheck of the remaining failing file | PASS: 37/37 Horse application tests, including the GROOM registry-read case, in8.55seconds. No assertion or timeout change. The full-run timeout did not reproduce in isolation; its precise cause is not proved. |
| TypeScript, lint, production build and bundle guard | PASS on the packaged source |
| Staging/Production isolation policy tests | PASS: 13/13; no hosted deployment |
| Changed-file secret-pattern scan | PASS: 111 initial candidate files, no private key, JWT/token literal or local review password found; this is a bounded scan, not a security certification |
| Git diff whitespace check | PASS before packaging |
| Fresh authenticated browser checks across seven roles | BLOCKED: BE8080 unavailable following SQL memory allocation failures |
| Earlier UI verification | Retained in the individual UI reports; it does not replace final authenticated checks on this candidate |
| Public browser checks on the fresh production build | PASS: Landing at 1440/1280/1024/390, image decode, anchors and Login navigation; Login 7 checks including focus, required fields and reduced motion. No API calls or business writes. |

`vite.config.ts` now pins `test.env.VITE_API_BASE_URL` to the fixture origin `http://localhost:8080`. This is a test-only setting. Development proxy configuration and deployable API origin validation are unchanged; no test assertion was relaxed. The first failed run is retained as diagnostic evidence.

Final verification commands: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot`, the isolated Horse test-file run with the same worker flags, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc -b --noEmit`, `node node_modules/typescript/bin/tsc -b`, `node node_modules/vite/bin/vite.js build`, `node scripts/check-production-bundle.mjs`, and `node --test scripts/staging-policy.check.mjs`. No business/API assertions were weakened. Temporary test/browser processes were closed after completion.

## Runtime and dependency blockers

SQL Server reported repeated error701. Read-only inspection observed low physical-memory flag1 and approximately0.8–1GB available on an8GB Windows machine. Strict-TLS connection/simple query and a read of8 horses succeeded in bounded probes, but a later metadata read failed08S01. This is not a stable end-to-end PASS. No SQL restart, memory reconfiguration, cache clearing or data reset was performed.

At the user's request,8 verified Docker Desktop/helper processes were stopped after checking that no containers were running. FE5214 and SQL were preserved. Claude sessions, personal browsers, Windows services and Codex core processes were not terminated. SQL still reported low physical memory after that cleanup; BE8080 remains unavailable. No cloud resource was changed.

The local BE candidate serves `/api/stable-care/*`, but that package is not present in inspected BE `origin/main` at `a214835cc6a8710b779106b1abb69c6cd4ed056f`. Flow4 therefore also requires its independently reviewed Backend implementation/migration for a main-to-main runtime. Publishing FE source alone does not complete that integration. No Backend publication is included here.

## Merge gate

Live FE main rules require a pull request, at least one approval, approval of the most recent push by another reviewer and resolved review conversations. Only merge commits are permitted. Keep the PR unmerged while required approval, final verification or runtime/dependency blockers remain. Do not alter these rules or enable automatic merge/deployment to deliver this candidate.

Production/Preview settings are unchanged. The existing `vercel.json` disables Git deployments; no hosted deployment was requested or created in this batch.
