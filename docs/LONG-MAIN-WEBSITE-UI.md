# Long — main website UI, 17 October 2026

Review branch: `feat/long-core013-027-029-ui`. Worktree: `long-main-ui`.
Official FE base: `f7c290d100c77ba6d33cf781aed9102f73c8a1bc`.
No merge into official dev/main is authorized in this delivery.

## Reused implementations

- CORE-013 local WIP `9fa06cfcb594ce74b30076e87d42bf61b6aa15a6`: reused horse onboarding, ported to the canonical design system, layout and shared auth. Original WIP was preserved.
- Published integration `18e3f2981e6a1d7872e502c7f6102b365e36921b`: CORE-022, CORE-033 and clean CORE-036/PR #8 (`51525af2065041d336ec52d6f6b6d0329e8106c9`). Legacy PR #2 was not used.
- CORE-046 Groom `228e6d5fa8042cf60c92bc655497be07be78f7c8`: existing treatment/incident components and service reused, with canonical shared-auth wiring.
- CORE-033 feature source remains identical to `324d51126745ae1f8d9121d939ff93076c004cdb`.
- No CORE-025 scheduling implementation was created; Hoàng retains that scope. No medical/Groom feature was rewritten in place of Đức's work.

Live GitHub read at this delivery confirmed FE dev still at the base above, CORE-036 PR #8 at `51525af`, CORE-046 PR #5 at `228e6d5`, and no open CORE-025 PR or remote head named CORE-025. This is an integration review branch; its compare includes these unmerged published dependencies and must not be mistaken for official-dev completion.

## Entry from normal login

Open `/login`. Accounts, roles, token restore and logout use CORE-008's canonical AuthProvider and CORE-007's real API. No role chooser, preview session or preview toolbar is registered. `/` leads to authenticated `/dashboard` rather than a component gallery.

| Role | Workspace/menu path | Implemented interactions |
|---|---|---|
| Club Manager | Dashboard → Horses | Search/filter/page register → horse profile → edit identity/photo |
| Club Manager | Horses → Register Horse | Identity/photo → pedigree + explicit ownership share/date → free stable box → Pending Activation |
| Groom | Login → Workspace → Today (`/groom/today`) | Date/assigned scheduled sessions → `/training/my-sessions/:id/pre-check` → five observations → normal check or explicit Incident report |
| Work Rider | Login → Workspace → My Rides (`/rider`) | Assignments → detail/instructions → six readiness confirmations → Start → active session |
| Work Rider | Active session | Manual measured sample → Finish when IN_PROGRESS → terminal feedback → history |
| Work Rider | Paused/interrupted session | Trainer-owned pause state; in-session issue → interrupted outcome; feedback never completes an interrupted ride |
| Head Trainer | Dashboard → Create program | Existing CORE-022 wizard |
| Trainer | Dashboard → Session results | Existing CORE-033 Result / Planned vs Actual / Evaluation / History |
| Veterinarian | Dashboard → Medical / Incidents | Existing clean CORE-036 medical/examination/injury/treatment/recovery and incident review |
| Groom | Today → Treatment Tasks / Incidents | Existing CORE-046 treatment completion, explicit incident reporting and reporter-safe views |

Canonical Work Rider routes: `/rider`, `/rider/assignments`, `/rider/assignments/:id`, `/rider/assignments/:id/start`, `/rider/sessions/:id/active`, `/rider/sessions/:id/feedback`, `/rider/history`. Older `/rides` list/history entry links redirect to these paths. Every shared header's Account menu opens `/account`, with canonical logout and a return to the workspace; roles are changed by signing in to the appropriate account, never by a preview selector.

## Real API versus explicit temporary sample adapter

`VITE_BUSINESS_DATA_SOURCE=api` is the default. API errors stay errors and never select sample data.
`VITE_BUSINESS_DATA_SOURCE=sample` explicitly selects one central business adapter for the unfinished horse/program/session/medical-case/incident/task APIs. A persistent **Sample business data** notice explains that these mutations only update this browser's local sample state. Authentication remains real in both modes. No fake token or local role selection exists.

`src/shared/data/businessData.ts` owns selection; `sampleTransport.ts`, `horseSamples.ts`, `sessionSamples.ts` share `racehorse.business-samples.v1`. Authentication storage is separate. Only a validated ACTIVE shared-auth actor can access samples. Synthetic staff references in samples are scenario references, not SQL accounts or evidence of backend row-scope enforcement.

Already implemented auth, health, medical restrictions and horse availability/batch endpoints remain on the real transport even in sample mode. Sample horse IDs have no implied matching SQL records: real availability can legitimately return an error, which remains visible. No clinical availability is inferred from a sample examination.

The local run uses `VITE_API_BASE_URL=/`, `VITE_API_PROXY_TARGET=http://127.0.0.1:8081`, `VITE_BUSINESS_DATA_SOURCE=sample`, port 5180. This is the existing app and route tree in a review worktree, not a separate preview app. The proxy is for local Vite only; deployments must supply their actual API base/reverse proxy.

Sample scenarios: horse 7, program 1001; terminal session 42 Interrupted and 43 Completed; 44/45 Scheduled needing Groom checks, 46 Paused, 47 In Progress, 48 future Scheduled. Checks on 44/45 carry through to Work Rider assignment in the same browser across logout/login. A normal check does not start a session. An abnormal check neither starts nor automatically creates an incident. Explicit reports connect to existing Vet incident/case handling. Measured blanks remain null and zero remains zero; no aggregate distance or performance formula is invented.

## Design/contract evidence and boundaries

Official Figma file `tm7dpgAQbHReZ7tlQeQJlc`, design context plus screenshots inspected:

- CORE-013: `281:2158`, `282:2377`, `283:2487`, `284:2588`, `285:2786`, `200:8678`.
- CORE-027: `244:556`, `248:667`, `250:756`.
- CORE-029 desktop: `416:9660`, `416:9756`, `430:10683`, `416:9837`, `425:10430`, `425:10068`, `432:10702`, `432:17289`, `429:10577`, `428:10472`, `426:10287`, `427:10371`, `431:10696`.

Wire authority: BE `docs/api/flow2-training.openapi.yaml` on dev `8b2e22a`; Flow 1/3 contracts and DEC-009 in the project documents. Activation is automatic after mandatory identity/pedigree/ownership/box/Vet-baseline requirements; the Club Manager cannot approve activation or record a clinical baseline. Activated-at starts the timeline; Head Trainer readiness review does not block activation.

Explicit remaining boundaries:

- Flow 1 activation-checklist item shape is not fully typed in the current contract. The CORE-013 view model names four mandatory checks; backend alignment remains required. Readiness is informational, not a new assessment entity or mutation. The request-baseline button remains disabled because no approved request operation exists. Newly registered sample horses correctly remain DRAFT awaiting a Vet baseline; this delivery does not add another member's baseline UI/API.
- Breed/sex suggestion lists are inherited Figma examples, not an approved closed vocabulary. Custom free-text values and existing server values are preserved. Name/code suffice to save a DRAFT; missing identity values remain null and still block activation. No schema enum was introduced.
- Pedigree names satisfy reference-XOR-name; unchanged existing parent references are preserved. Ownership is explicit; no silent single-owner/100-percent assumption.
- CORE-027 uses exactly the five approved keys and per-item observations. The Figma standalone Notes field is omitted from the wire because the request schema disallows extra properties. Groom assignment persistence is an acknowledged BE model gap; samples are not acceptance evidence for that RBAC dependency.
- Start confirmations are UI-only; start submits no invented readiness fields. No early start and no Work Rider Pause/Resume/Stop. A scheduled rider who is not ready is directed to the assigned Groom/Trainer; the mid-session issue mutation is reserved for IN_PROGRESS/PAUSED.
- Feedback uses approved `responses` fields rather than inventing Figma-only wire fields. Completed and Interrupted remain separate outcomes.
- Session state refreshes by REST every five seconds, reports synchronization loss and disables actions while stale. This is not a WebSocket implementation or WSS integration PASS. Current exercise/repetition progression is not supplied by the contract and is not inferred.
- Incident photos/3D injury rendering and unrelated optional modules are not added. Existing clean CORE-036 uses its supplied injury fallback.

## Verification limits

Focused fixture checks before final composition: CORE-013 initially 6/6, then 13/13 including review regressions; CORE-027 initially 9/9, then 10/10; CORE-029 16/16; central cross-role sample transport 6/6. Canonical CORE-046 test-fixture compatibility checks passed 19/19 without changing its product screens, skipping tests, increasing timeouts or weakening functional assertions. Author/unit fixture tests do not establish real SQL business-flow integration or a full Independent Gate.

Historical CORE-033 evidence stays separate: author 118/118; prior independent full-suite 116/118 with timeouts in COMPLETED evaluation submit and Groom validation. This delivery does not replace that independent record with an author conclusion or edit CORE-033 source/tests. The combined branch has additional tests and a different test count.

At 08:04 ICT the normal browser login reached the real proxy and failed because the BE could not connect to `localhost:1433`. Read-only service inspection confirmed MSSQLSERVER was Stopped. Windows rejected `Start-Service`: `Cannot open 'MSSQLSERVER' service on computer '.'`. No database was created/reset/seeded/migrated during this UI delivery. Leader must start the existing SQL Server service with sufficient Windows rights before real login can be verified. Logs and private existing local credentials remain outside Git in `.preview-local/`; never include passwords or tokens in a PR.

Final combined branch validation: **243/243 tests passed** with `vitest run --maxWorkers=1`; whole-tree ESLint, TypeScript no-emit, TypeScript build, Vite production build and diff check passed. Build reports the existing combined-main-chunk size warning (about 578 kB minified); no warning threshold was raised. JSON evidence remains in `.preview-local/long-main-ui-final-tests.json` outside Git.

Independent static review identified four P2 findings (account/logout entry, precheck conflict recovery, activation pagination and free-text identity); all were corrected with regression tests and re-reviewed. That reviewer did not execute SQL/browser validation or rerun the final suite. This is **not a final-HEAD full Independent Gate**. No CORE-013/027/029, CORE-033 or CORE-009 task is declared Done solely from fixture execution. Exact committed HEAD/base and compare are recorded in the local handoff/PR body.
