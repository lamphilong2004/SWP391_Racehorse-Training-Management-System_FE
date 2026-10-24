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
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | Final immutable source `5f35d5e`: 990/990 PASS, 86 files, 189.67s; earlier runs retained separately |
| Training `supporting.test.tsx` + `ProgramListPage.test.tsx`, 1 worker | 28/28 PASS |
| New table/registry regression selection | 33/33 PASS |
| Final Horse application regression at `5f35d5e` | 31/31 PASS |
| `git diff --check` | PASS |

Final source HEAD: `5f35d5eaee03b2a6a1449c7b32a1a9bce405a6de`. Full suite, lint, typecheck, production build, production-bundle guard, 16 policy checks and diff check were rerun at this exact source HEAD on 24 October: PASS. The test receipt confirms identical start/end HEAD and exit 0; only report files were edited while it ran. The subsequent delivery commit changes documentation only. Local logs: `tests-5f35d5e-immutable.log` and `tests-5f35d5e-receipt.json` in `_gate-monitor/enterprise-v4/`.

The earlier 265.62s full run started at `2f9e4a6`; the compact DRAFT readiness follow-up was applied while it ran. That mixed-revision run remains historical evidence and is superseded by the final immutable 990/990 run above. The follow-up also has its own 31/31 Horse regression PASS. No assertion or security check was weakened. These author checks are not an Independent Gate.

## Actual integration evidence

Isolated database `racehorse_presentation_20261023`; existing Backend JAR, strict JDBC TLS and JPA validate. Existing source database is read/backup only.
Seven JWT logins and `/me` identities PASS, anonymous Horse read 401, Owner administration 403, Owner unowned Horse profile 403. Horse creation → setup → baseline → automatic activation → program/session → evaluation verified through real APIs. Separate abnormal precheck rejects start; observation-only medical care and restriction retention verified.

Actual browser submissions: Groom all-normal precheck (persists after refresh), Work Rider start/complete/feedback, Trainer evaluation (persists after refresh). Seven-role sidebar navigation was exercised; individual loading states and expected start-gate warnings are recorded distinctly. Final read-only detail checks covered Owner Profile/Health/Training and Vet case/treatment plus fully loaded herd health. Console error retrieval returned an empty list. These results do not imply every possible screen/modal/error path was browser-tested.

No telemetry values, unavailable performance metrics or API success responses were fabricated. Operational/clinical scenario records are explicitly SIMULATED and attached only to fictional horses.

## Remaining verification limits

- 125% browser zoom was not established by the tool; keyboard zoom commands left measured scaling unchanged.
- Horse registry and herd health passed the four actual requested viewport dimensions; the whole route/state cross-product has not been verified at every viewport.
- Table long-text/21-row and failure/slow-response checks use test fixtures; the current real SQL Horse list contains seven meaningful records, not an artificially inflated pagination dataset.
- No cloud deployment, production rollout, backend code change, existing database reset or schema modification.
- Initial local runner mistakes (availability field name and mutually exclusive pedigree input) were corrected to match existing contracts; failed attempts remain in local evidence. No Backend fix or database bypass was used.
