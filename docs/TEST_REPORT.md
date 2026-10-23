# Enterprise V4 verification

Base: `985808c90a8f9c5cba018a6b58a5f6c462ebd9dd`. Branch: `design/enterprise-ui-v4`.

Commands use the pinned installed Node executables directly because Windows npm command wrappers are unreliable in this workspace path.

| Check | Observed result |
|---|---|
| `npm ci --ignore-scripts` | PASS; unchanged lockfile, 238 packages, audit 0 vulnerabilities |
| `node node_modules/eslint/bin/eslint.js .` | PASS |
| `node node_modules/typescript/bin/tsc -b --noEmit` | PASS |
| `node node_modules/vite/bin/vite.js build` | PASS |
| `node scripts/check-production-bundle.mjs` | PASS |
| `node --test scripts/enterprise-ui-policy.check.mjs` | 16/16 PASS |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | 990/990 PASS, 86 files, 305.67s; followed by targeted verification of final Training presentation fixes |
| Training `supporting.test.tsx` + `ProgramListPage.test.tsx`, 1 worker | 28/28 PASS |
| New table/registry regression selection | 33/33 PASS |
| `git diff --check` | PASS |

The final candidate will be rechecked after all source changes, with the code SHA and log location recorded in the local checkpoint. Do not interpret historical results as an Independent Gate or a main merge.

## Actual integration evidence

Isolated database `racehorse_presentation_20261023`; existing Backend JAR, strict JDBC TLS and JPA validate. Existing source database is read/backup only.
Seven JWT logins and `/me` identities PASS, anonymous Horse read 401, Owner administration 403, Owner unowned Horse profile 403. Horse creation → setup → baseline → automatic activation → program/session → evaluation verified through real APIs. Separate abnormal precheck rejects start; observation-only medical care and restriction retention verified.

Actual browser submissions: Groom all-normal precheck (persists after refresh), Work Rider start/complete/feedback, Trainer evaluation (persists after refresh). Seven-role sidebar navigation was exercised; individual loading states and expected start-gate warnings are recorded distinctly. These results do not imply every possible screen/modal/error path was browser-tested.

No telemetry values, unavailable performance metrics or API success responses were fabricated. Operational/clinical scenario records are explicitly SIMULATED and attached only to fictional horses.

## Remaining verification limits

- 125% browser zoom was not established by the tool; keyboard zoom commands left measured scaling unchanged.
- Horse registry passed the four actual requested viewport dimensions; the whole route/state cross-product has not been verified at every viewport.
- Table long-text/21-row and failure/slow-response checks use test fixtures; the current real SQL Horse list contains seven meaningful records, not an artificially inflated pagination dataset.
- No cloud deployment, production rollout, backend code change, existing database reset or schema modification.
- Initial local runner mistakes (availability field name and mutually exclusive pedigree input) were corrected to match existing contracts; failed attempts remain in local evidence. No Backend fix or database bypass was used.
