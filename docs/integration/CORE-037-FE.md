# CORE-037 Frontend integration handoff

Status: **BLOCKED** (14 October 2026). Worktree `SWP391_Racehorse-Training-Management-System_FE_CORE037`, branch `feat/CORE-037-flow3-integration`, initially clean. No commit, push, merge, cherry-pick or branch switch was performed. Backend worktrees were read only.

## Architecture and dependency inventory

FE `HEAD` and `origin/dev` contain only `README.md`: no `package.json`, React app, router, API client, auth provider, UI components or test runner. FE `origin/feat/CORE-002-shared-design-system` has a Vite/React/TypeScript foundation with React Router, Vitest, Testing Library and ESLint. FE `origin/feat/CORE-036-vet-medical-groom-ui` extends it with role-gated medical/Groom routes and a mock-only `MedicalService`. Neither is merged into FE dev. Its `runtimeClient.ts` checks `/api/auth/me`, but the route wrapper supplies no access token; real medical operations throw an unavailable error.

BE `origin/dev` has shared OpenAPI and permission matrix only. BE CORE-006, CORE-026 and CORE-035 exist on unmerged feature refs. CORE-026's Incident list/detail implementation and CORE-035's case/exam/injury/plan/re-exam handlers are reference implementations, not a deployable combined application. CORE-035 requires production `ActorResolver`, `IncidentLink` and `GroomTaskScope`; those adapters are absent on its branch. CORE-019 restriction implementation and FE training actions were not available. Availability/merge state for CORE-009, 011, 018 and 020 could not be verified from the available FE/BE dev trees; CORE-026, 035, 036 and CORE-002 are not merged into dev.

## Delivered independently

- `scripts/core037/contract-check.mjs` and its Node built-in tests inspect Git refs without copying feature code. They check 13 path/method pairs, key DTO fields, empty Groom completion body, shared error vocabulary, restriction contract presence and that F36's real service is unavailable. Run `node --test scripts/core037/contract-check.test.mjs`.
- `scripts/core037/live-smoke.mjs` is a real HTTP preflight and API smoke suite. It checks FE route host, missing JWT 401, Vet cases/incidents, Groom-only scoped work list and safe projection, wrong-role 403 and optional real re-exam POST/GET persistence. It exits 2 as `BLOCKED` when services or tokens are missing. It is not a browser E2E suite.
- `.env.core037.example` documents local endpoints and test inputs without credentials. Tokens must be supplied through the process environment.
- The API matrix and test-case register record exact incompatibilities and the remaining owner actions. No CORE-036 source or unpublished Backend code was copied into this branch.

## Security boundary

Frontend role gates are for user experience. Backend must verify JWT, active account, role and row scope. The Groom endpoint must return only assigned operational instructions, never clinical case data. All actors and completion times are supplied by the server. The live script sends tokens only as Authorization headers and never logs them. The FE must treat 401, 403, 404 and 409 as safe user states without echoing raw server internals or bearer tokens. Recovery and case closure must not lift `MedicalRestriction`; CORE-019 must expose an explicit approved action.

## Remaining integration work after merges

1. Merge the FE foundation and CORE-036 via their owners. Add a typed HTTP adapter behind its `MedicalService`, using the approved base URL, shared envelope, bearer token from shared auth and safe error mapping. Replace draft string IDs, bare arrays and mock-only data with numeric/paged Backend DTO mapping.
2. Resolve C006 review gaps G1–G4, approve its contract, and wire BE JWT, Incident link and trusted Groom task assignment/materialization. Reconcile F36's medication editor, 3D marker and completion-note UI with approved storage and business decisions; do not silently drop entered clinical content.
3. Merge CORE-019 and training UI. Fetch server availability and active restriction state; block restricted actions in the UI while relying on Backend enforcement. Add explicit restriction review after recovery, with no automatic lift.
4. Run typecheck, ESLint, Vitest and build in the merged FE app; add adapter unit tests and browser E2E against actual FE/BE with isolated fixture identities. Run the live suite, including write/persistence and cross-user cases, then update this status from observed evidence.

## Commands

```text
node --test scripts/core037/contract-check.test.mjs
node scripts/core037/contract-check.mjs
node scripts/core037/live-smoke.mjs
git diff --check
```

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` are unavailable in this branch because `package.json` is absent. The Node scripts require no new dependencies. The actual Backend and FE services were not started or verified here.
