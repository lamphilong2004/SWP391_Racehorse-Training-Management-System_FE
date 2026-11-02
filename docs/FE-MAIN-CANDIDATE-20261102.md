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
| Full FE test suite, one worker | PASS:1073/1073 tests,96/96 files after authorized resource cleanup,403.75seconds. Same assertions, per-file isolation and20second timeout. Runtime/application source tested at54a55f2; subsequent changes in this batch are documentation only. |
| Isolated recheck of the remaining failing file | PASS: 37/37 Horse application tests, including the GROOM registry-read case, in8.55seconds. No assertion or timeout change. The full-run timeout did not reproduce in isolation; its precise cause is not proved. |
| TypeScript, lint, production build and bundle guard | PASS on the packaged source |
| Staging/Production isolation policy tests | PASS: 13/13; no hosted deployment |
| Changed-file secret-pattern scan | PASS: 111 initial candidate files, no private key, JWT/token literal or local review password found; this is a bounded scan, not a security certification |
| Git diff whitespace check | PASS before packaging |
| Fresh authenticated browser checks across seven roles | PASS after resource cleanup:103 role/route renderings,412 viewport checks at1440/1280/1024/390,0 findings/page errors/console errors/HTTP failures. Additional form/modal verification:48 checks/35 actual API requests PASS, including focus, required fields, reduced motion and guarded cancellation. No business writes. |
| Earlier UI verification | Retained in the individual UI reports; it does not replace final authenticated checks on this candidate |
| Public browser checks on the fresh production build | PASS: Landing at 1440/1280/1024/390, image decode, anchors and Login navigation; Login 7 checks including focus, required fields and reduced motion. No API calls or business writes. |

`vite.config.ts` now pins `test.env.VITE_API_BASE_URL` to the fixture origin `http://localhost:8080`. This is a test-only setting. Development proxy configuration and deployable API origin validation are unchanged; no test assertion was relaxed. The first failed run is retained as diagnostic evidence.

Earlier results are retained: the first run had962 PASS/111 FAIL in9 files because local same-origin configuration leaked into HTTP fixtures; all153 tests in those files passed after using the fixture origin. The next full run had1072 PASS/1 Groom-read timeout; that entire Horse file passed37/37 in isolation. After closing authorized auxiliary apps, the new full run passed1073/1073. The precise cause of the earlier isolated timeout is not proved. Existing non-fatal React `act` warnings were not suppressed; no assertion or timeout was changed to obtain the pass.

Final verification commands: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot`, the isolated Horse test-file run with the same worker flags, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc -b --noEmit`, `node node_modules/typescript/bin/tsc -b`, `node node_modules/vite/bin/vite.js build`, `node scripts/check-production-bundle.mjs`, and `node --test scripts/staging-policy.check.mjs`. No business/API assertions were weakened. Temporary test/browser processes were closed after completion.

## Runtime and dependency blockers

SQL Server reported repeated error701. Read-only inspection observed low physical-memory flag1 and approximately0.8–1GB available on an8GB Windows machine. Strict-TLS connection/simple query and a read of8 horses succeeded in bounded probes, but a later metadata read failed08S01. This is not a stable end-to-end PASS. No SQL restart, memory reconfiguration, cache clearing or data reset was performed.

Initially,8 verified Docker Desktop/helper processes were stopped after checking that no containers were running; BE remained blocked. The Leader subsequently explicitly authorized closing all Claude/Claude Code and then other personal apps for testing. Chrome, Edge and Zalo were closed after verifying executables/process trees; Codex, Windows services, FE and SQL were preserved. Zalo's renderer-first shutdown triggered a relaunch; a bounded root-first closure completed it without an ongoing kill loop or changing autostart settings.

The pinned candidate Backend now runs locally on8080 with a private low-memory JVM option (256MB heap, SerialGC, bounded code cache/processor count); this does not change the repository's production config, JWT/RBAC, strict SQL TLS or JPA validation. Actual readback passed34 events across all seven real accounts: login/me/ACTIVE-role checks, Horse/Training/Medical/Flow4 reads and logout. Real API boundary checks passed36 events:401 anonymous, expected role403s, assigned-Groom task scope, and two null-item DTO400 responses before service execution. These are read/validation proofs, not a replay of all four business write journeys. No database reset, instance reconfiguration, migration or business write was performed by this verification; normal auth timestamp/audit side effects remain.

The local BE candidate serves `/api/stable-care/*`, but that package is not present in inspected BE `origin/main` at `a214835cc6a8710b779106b1abb69c6cd4ed056f`. Its implementation is available in [BE PR35](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/pull/35). Flow4 still requires independent Backend review and release/migration decisions for a main-to-main runtime. Publishing FE source alone does not complete that integration; Backend changes remain in the separate PR.

## Merge gate

Live FE main rules require a pull request, at least one approval, approval of the most recent push by another reviewer and resolved review conversations. Only merge commits are permitted. Keep the PR unmerged while required approval, final verification or runtime/dependency blockers remain. Do not alter these rules or enable automatic merge/deployment to deliver this candidate.

Production/Preview settings are unchanged. The existing `vercel.json` disables Git deployments; no hosted deployment was requested or created in this batch.
