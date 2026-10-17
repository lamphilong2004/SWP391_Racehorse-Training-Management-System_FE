# CORE-036/046 — real auth + coherent demo medical data

Owner: Nguyễn Đình Minh Đức. Updated 2026-10-17 (Asia/Bangkok).

## Delivery and review

Branch: `feat/CORE-036-046-incident-integration`. This combines clean Vet CORE-036 and Groom/Incident CORE-046 through the canonical CORE-008 AuthProvider, authSession, router and AppShell. There is one website: login → workspace/menu → role-owned pages. No showroom, role switcher, alternate login or token provider is added.

The existing feature merge has been resolved. Commit/push is authorized for review; no dev/main push, force push, PR merge or tracker update. Final pushed HEAD and PR/compare URL are reported after publication.

## Data-source matrix

| Function | Selected source | Evidence and boundary |
| --- | --- | --- |
| Login, `/me`, restore, logout, roles | Real CORE-007/008 HTTP | Canonical implementation retained. HTTP fixture tests pass; live runtime currently unavailable on this machine. |
| Case, Exam, Injury, Treatment, Recovery, Close | Demo adapter | Connected mutations and persisted readback tested; complete runtime controllers not present in the inspected auth/restriction integration. |
| Groom assignments/list/complete | Same demo dataset | Real authenticated actor IDs; assigned-only operational projection; cross-role state survives reload/login changes. |
| Report/list/detail Incident and Vet review | Same demo dataset | OPEN_CASE/LINK_CASE/RESOLVE update the same case/incident graph. |
| Herd health, availability/restriction visibility | Same demo dataset | CORE-019 real endpoints exist, but real horse/restriction IDs are not mapped to demo horses. Keep this graph coherent rather than send demo IDs to that runtime. |

The connected Medical/Incident/Groom graph switches as one unit. Auth always stays real. There is no automatic fallback on 401/403/404/409 or network errors. Endpoint existence alone does not establish compatible entity mapping.

## Configuration and login

Copy the safe `.env.example` to the ignored `.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_MEDICAL_DATA_SOURCE=demo
VITE_DEMO_DELAY_MS=150
VITE_DEMO_GROOM_USER_ID=
```

- API base is the real CORE-007 origin; an explicit empty value supports a same-origin `/api` proxy.
- `demo` selects local business data after real login, in dev or a deliberately configured demo build.
- `api` uses real HTTP for the whole graph, without fallback. Verify real entities before switching; reopen list screens and do not reuse demo detail URLs/IDs for real writes.
- Optional Groom ID sets initial sample ownership to a real account. If blank, initial sample assignments bind once to the first ACTIVE authenticated Groom opening the demo. Later accounts cannot take over the assignments. Newly created plan tasks retain the explicitly entered real Groom ID.
- Restart Vite after env changes. No passwords, JWTs or other secrets belong in `VITE_*` config.

Run from this FE folder:

```powershell
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

URL: `http://127.0.0.1:5178/`. Sign in normally with ACTIVE Vet/Groom accounts issued by BE. The CORE-007 local runbook names `core007.veterinarian@example.test` and `core007.groom@example.test`; these work only if that isolated runtime was provisioned. Obtain passwords from the owner's private credential store. No passwords are included in this repository.

At audit time no auth server listened on 8080/8081. The supplied workspace search and the runbook's credential location did not contain CORE-007 account credentials. Real authenticated browser/SQL verification is therefore blocked until its runtime origin and private credential source are available. Do not conceal this dependency with mock auth.

## Workflow and routes

| Route | Function |
| --- | --- |
| `/login`, `/dashboard` | Shared login, role workspace, sign out |
| `/medical` | Vet list, search, pagination, create |
| `/medical/cases/new` | Create; validation; working Cancel/back |
| `/medical/cases/:caseId` | Record, examination, injury, treatment, re-examination, explicit close |
| `/medical/cases/:caseId/treatment-plan` | Plan/Groom assignment editor, save-success notice and Cancel/back |
| `/medical/herd-health` | Herd overview |
| `/medical/my-tasks` | Groom Today/Upcoming/Completed, filters, complete/report |
| `/incidents` | Shared reporter-safe list/filter and Groom report modal |
| `/incidents/:incidentId` | Vet review or permitted reporter-safe detail, one route registration |

Demo sequence: Groom reports → Vet opens/links Case → examination/injury → plan assigned to real Groom ID → Groom completes → Vet records RECOVERED → resolves Incident → closes Case when prerequisites pass. Use a fresh horse-102 case for close-success; seed Case 1 has an active restriction and remains blocked.

Loading, empty, error/retry, action conflicts and success feedback remain in the existing UI. A 409 preserves input. Incident submit success is separate from subsequent refresh failure. Editing a plan preserves completed tasks. Recovery/closure never automatically lift a restriction. Photo upload and optional modules remain outside this delivery.

## Implementation and persistence

- `shared/auth/authApi.ts`: canonical HTTP/envelope/errors; no demo auth routing.
- `shared/services/medicalTransport.ts`: central source selector used by both MedicalService and Core046Client.
- Medical/Core046 route providers pass the current actor from `useAuth`, without a competing session.
- `mocks/medicalDemo.ts`: business data only; no auth endpoints, credentials, token issuance or token storage. Real Authorization headers are removed before calling it.
- Storage key `racehorse.medical-demo.v2` persists the graph across reload and account changes in the same browser origin. Previous all-mock storage is not reused.
- FE compared with Leader `origin/integration/CORE-022-033-036` at `18e3f29`; shared auth structure stays compatible. No unrelated leader modules copied here.

## Verification and limitations

Final lint/typecheck/tests/build/diff results are reported against the published code revision. Tests cover cross-role persisted flow, row scope, completed-history preservation, conflicts, source configuration, real shared-auth selection even in demo mode, absence of fallback and no JWT in demo storage.

FE fixture/demo tests are author verification, not Independent Gate, real SQL persistence, backend RBAC acceptance or Figma pixel acceptance. The previous all-mock browser screenshot is historical and does not establish a successful real-auth login for this revision.

## Dependencies and next steps

The integration includes PR #8's clean Vet code and PR #5's Groom code. Keep #8 Vet-only; do not merge the same Groom implementation twice through #5 and this integration. Review is stacked on `feat/CORE-036-vet-medical-clean`; after that dependency merges, Leader can retarget/reconcile with dev or the Leader integration branch.

Next supply the live CORE-007 origin/private credential source, verify login → `/me` restore → logout/CORS in the browser, then switch the entire medical graph to API only after contracts and entity mapping are ready. Verify BE/SQL and RBAC independently. Do not mark all CORE Done from a working demo.
