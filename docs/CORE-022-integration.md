# CORE-022 / CORE-033 / clean CORE-036 integration checkpoint

Date: 2026-10-17. Branch: `integration/CORE-022-033-036`. Worktree: `CORE-022-integration`.
This is a separate integration branch for review; it is not code added to the CORE-022 feature PR.

## Exact inputs

| Input | SHA |
| --- | --- |
| FE dev fetched | `f7c290d100c77ba6d33cf781aed9102f73c8a1bc` |
| CORE-022 published implementation/evidence | `26aad8db815a72565ad7970451acc745dde4962a` |
| CORE-033 | `324d51126745ae1f8d9121d939ff93076c004cdb` |
| Clean CORE-036 / PR #8 | `51525af2065041d336ec52d6f6b6d0329e8106c9` |
| CORE-022 documentation-only follow-up | `4373a07aefe748ca631da38999e0c0e7f174ba02` |

The documentation follow-up does not change src relative to 26aad8d. Original CORE-022 author evidence is 128/128;
the combined result below is separate and is not Independent Gate or live BE verification.

## Actual merges and conflict resolution

Order: dev → CORE-022 → CORE-033 → clean CORE-036 → CORE-022 documentation update. No reset, rebase or force-push;
no other owner's checkout or branch was modified. The legacy CORE-036 branch was not used.

- CORE-022 merged cleanly.
- CORE-033 conflicted in `src/app/router.tsx` and `src/app/router.test.tsx`; routePaths merged automatically.
- Clean CORE-036 also conflicted in router.tsx/router.test.tsx. RequireAuth and routePaths merged automatically.
- Kept both feature imports and all registrations in each router conflict. Kept the exact production route-list
  assertion and added all valid feature routes; existing dev-only route and auth assertions were retained.
- RequireAuth keeps optional allowedRoles and the HEAD_TRAINER program guard. PublicOnly keeps CORE-036's return to
  the requested pathname after login. CORE-036's inactive-account restore handling remains in shared AuthProvider.
- Evaluation preserves the approved read roles; only Trainer can submit evaluation. MedicalAccess gates Vet before
  mounting medical pages. The integration does not narrow evaluation readers to Trainer alone.
- One application AuthProvider, requestApi API base and authSession token store. MedicalProvider is only clinical
  service context, not another auth provider. No runtime fixtures/fallbacks.
- There is **no Design System/navigation conflict** from these clean inputs; their diffs are empty in those areas.

## Verification on the actual combination

| Check | Result |
| --- | --- |
| Full `vitest run --maxWorkers 2` | **179/179 PASS**, 18 files, 36.47s |
| `npm run lint` | PASS, no warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, 175 modules |
| `git diff --check` | PASS |
| Production-preview Chrome 155 / 1440×1000 | PASS with HTTP fixtures; no page/console/request errors |

The existing feature suites account for 165 tests. New `src/app/feature-integration.test.tsx` adds 14 regressions:
Head Trainer → Create program; Trainer → Evaluation with Save Evaluation available; Vet → Medical; all three return
to the requested feature after signing in; eight invalid-role/route pairs stop after /me without a feature request.
Requests assert the same API origin and shared bearer token; ordinary role denial preserves the session.

Browser smoke against the actual production bundle executed:

1. Head Trainer workspace → full seven-step wizard → exactly one create POST → program ID 1001 → GET read-back.
2. Trainer → Evaluation, then denied at Create program before feature fetch.
3. Vet → Medical.
4. Groom → denied at Evaluation before result fetch.

Browser data is explicitly HTTP fixtures, not real accounts/BE. Login return behavior is exercised by the actual
router/AuthProvider/requestApi in the tests. Screenshots are in [evidence/CORE-022-integration](evidence/CORE-022-integration).

## Owner patches / merge instructions

- [routing-vs-clean-core036.patch](integration/routing-vs-clean-core036.patch) records only RequireAuth, routePaths,
  router and router.test composition against PR #8. It expects CORE-022/033 feature files to be available. Do not
  cherry-pick this entire integration branch into any individual feature PR. This is a zero-context patch against
  the exact clean input SHA; use `git apply --check --unidiff-zero` before applying. Its reverse check passed on the
  composed worktree with `git apply --reverse --check --unidiff-zero`.
- Leader/shared router owner: use the patch when resolving the feature merges; preserve all eleven production route
  entries and both auth behaviors. The 14 integration tests can accompany the composed router after all features land.
- CORE-022: no program logic bug found in the combination; no CORE-033/036 code needs porting into its feature branch.
  Only corrected handoff/BE endpoint documentation is published there.
- CORE-033/CORE-036: no business-code patch was necessary. Their HTTP adapters and role gates passed the combination
  checks unchanged. Preserve their approved permissions and canonical controls when merging.

## Executed live probe and external blockers

Both real GET requests to `http://localhost:8080/api/health` and `/api/auth/me` failed with:

```text
No connection could be made because the target machine actively refused it. (localhost:8080)
```

BE dev `8b2e22a` has no wizard controller implementation. CORE-007 auth exists at `022e028` but no reachable deployed
runtime/account configuration was supplied. Demo `f1f386d` has wizard routes with incompatible page/version/
recommendation/Trainer/create/read-back DTOs. See [the endpoint matrix and requests for Tiến/Dũng](CORE-022-BE-endpoints.md).

**LIVE INTEGRATION NOT VERIFIED.** No live login, program persistence/assignment, lineage/version, backend LOCKED
rejection or template immutability PASS is claimed. Those checks require the contract-compatible implementation,
runtime/CORS and concrete seeded accounts/resource IDs listed in that handoff. No fixture result substitutes for them.
