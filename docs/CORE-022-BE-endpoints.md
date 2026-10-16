# CORE-022 — BE endpoint gaps and live smoke handoff

Inspection date: 2026-10-17. No BE checkout was reset or modified. No password/token is included here.

## Verified source revisions

- Contract / BE dev: `8b2e22a2aee710cc2ac9b3d1c372cb444ac9e21a`.
- CORE-007 auth implementation: `022e02803178c968bfc299e33908e6b23a5ce2bb` (not on dev).
- Existing demo implementation: `f1f386dc55ea51530576b5b8fe9a51e79d65d68e` (not approved as the contract replacement).
- FE program implementation: `26aad8db815a72565ad7970451acc745dde4962a`, `src/features/program-creation/programApi.ts`.

BE dev contains the foundation health/controller/configuration plus contracts. A search of fetched remote Java
controller sources found wizard routes only on `demo/main-flow-hour1`; no canonical CORE-021 implementation branch
is currently present among the fetched refs. This is a source inspection result, not proof of external deployment status.

## Every wizard endpoint

| Request the FE actually sends | BE dev / CORE-007 source | Demo source difference to fix before live use |
| --- | --- | --- |
| GET `/api/horses?lifecycle=ACTIVE&q=...&page=0&size=20` | No HorseController on either revision | HorseController supports these filters; HorseService.Page returns `totalElements`, whereas approved Page has `totalItems`/`totalPages`. Confirm CORE-004 page schema. |
| GET `/api/program-templates?status=ACTIVE&q=...&page=0&size=20` | Not implemented | Controller accepts only `includeArchived`; returns a bare list of flat Template objects, not Page<TemplateSummary> with latestVersionNo. |
| GET `/api/horses/{horseId}/template-recommendations` | Not implemented | Returns Recommendation with nested `item`; contract requires flat templateId/templateVersionId/versionNo/name/templateCode/label/reasons. |
| GET `/api/program-templates/{templateId}?versionNo={versionNo}` | Not implemented | Controller ignores versionNo; service always selects MAX(version_no). Returns a flat Template rather than `{template, version, versions}`; requiredSkills are strings instead of refs. Older-version pinning cannot be verified. |
| GET `/api/horses/{horseId}/trainer-recommendations?templateVersionId={pinnedVersionId}` | Not implemented | Accepts templateId instead of templateVersionId; returns Recommendation[] with `item`/boolean hardBlock rather than CandidateList with candidates[].user and nullable string hardBlock. |
| POST `/api/training-programs` | Not implemented | Requires flat trainerUserId rather than nested trainer `{trainerUserId,effectiveFrom,reason,warningsAcknowledged}`. Assignment derives its date/reason instead of accepting the contract values; warning acknowledgement is not implemented. Phase order is generated from array position. Returned Program DTO also differs below. |
| GET `/api/training-programs/{programId}` | Not implemented | Returns nested sourceTemplate and trainer; contract uses sourceTemplateId/sourceTemplateVersion/currentTrainer. Phase read-back lacks templateVersionPhaseId, preventing lineage verification from that response. |

No FE fallback or alternative payload has been added for these differences. In particular, FE will not flatten Trainer,
silently select the latest version, or invent a date/lineage mapping to make the demo appear integrated.

### Primary code evidence

- [Approved CORE-005](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/8b2e22a2aee710cc2ac9b3d1c372cb444ac9e21a/docs/api/flow2-training.openapi.yaml).
- [Demo TrainingController, lines 30–64](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/f1f386dc55ea51530576b5b8fe9a51e79d65d68e/src/main/java/com/racehorse/training/TrainingController.java#L30).
- [Demo DTOs, lines 31–47](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/f1f386dc55ea51530576b5b8fe9a51e79d65d68e/src/main/java/com/racehorse/training/ProgramService.java#L31).
- [Demo create/assignment behavior, lines 135–185](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/f1f386dc55ea51530576b5b8fe9a51e79d65d68e/src/main/java/com/racehorse/training/ProgramService.java#L135).
- [Demo read-back and latest-version query, lines 226–275](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/f1f386dc55ea51530576b5b8fe9a51e79d65d68e/src/main/java/com/racehorse/training/ProgramService.java#L226).
- [Demo horse paging, line 57](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/f1f386dc55ea51530576b5b8fe9a51e79d65d68e/src/main/java/com/racehorse/horse/HorseService.java#L57).

## Auth/runtime: implemented vs deployment unknown

CORE-007 AuthController implements POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/logout` (204), using the
shared envelope/DTOs. These exist on the auth branch, not current dev. Health exists on dev. No deployment URL or
safe test-account configuration was supplied/discovered for this task. At the canonical default localhost:8080,
both GET `/api/health` and GET `/api/auth/me` were actually attempted and failed:

```text
No connection could be made because the target machine actively refused it. (localhost:8080)
```

Classification: wizard implementation is missing from approved dev/auth source; compatible deployment is unverified;
local runtime is not listening. An endpoint existing in demo source does not establish deployment or contract parity.

## Requests for Leader to relay

**Tiến / program API**

1. Supply implementation SHA/PR for all seven wizard requests, preserving the approved CORE-005 wire types above.
2. Honor explicit versionNo and templateVersionId; return stable phase lineage and currentTrainer for read-back.
3. Accept nested Trainer effectiveFrom/reason/warningsAcknowledged. Verify assignment persistence and warning checks.
4. Supply sample resource IDs: an ACTIVE/AVAILABLE horse without an ACTIVE program, an ACTIVE/LOCKED horse with a Vet
   reason, an ACTIVE template with at least two versions and phases, and valid Trainer candidates including warnings.
5. Confirm persisted phase order/lineage/customization and a 409 LOCKED rejection. If effectiveFrom/reason cannot be
   read from a contract endpoint, provide a safe BE-side DB/assertion result; do not add a speculative FE endpoint.

**Dũng / auth and runtime**

1. Supply a reachable runtime URL and the deployed BE revision(s), or local startup configuration through an ignored
   local file/environment. Configure SQL Server DB_URL/DB_USERNAME/DB_PASSWORD, JWT_SIGNING_KEY,
   JWT_ACCESS_TOKEN_TTL_SECONDS and CORS_ALLOWED_ORIGINS on the BE side. No values in chat or PR.
2. Supply test-account access through safe local configuration: ACTIVE Head Trainer, Trainer candidate, and an
   unauthorized role/inactive account scenario. FE uses only canonical VITE_API_BASE_URL and auth storage.
3. Confirm inactive `/me` uses the existing 403 FORBIDDEN message `Your account is deactivated.` (or provide an approved
   contract change). Ordinary permission 403 must remain distinguishable; no new FE error codes are introduced.

## Live smoke and required evidence

1. Login Head Trainer → GET /me → refresh/restore → workspace. Record status codes and role, never password/JWT.
2. GET ACTIVE horse/catalog/recommendations → choose explicit older template version → snapshot that version before edits.
3. Fill supported program/phase fields; choose Trainer/effectiveFrom/reason and acknowledge actual warnings.
4. Submit exactly one POST. GET the returned ID; compare horse, period, name, source version, phases/order/lineage,
   intensities/workload and currentTrainer. Verify data again after refresh; verify assignment effectiveFrom/reason via BE evidence if omitted from read-back.
5. GET the same source template/version again; compare its immutable version fields/phases. Usage counts may change.
6. Send a valid test create request for the designated LOCKED horse directly to BE (UI disabling is insufficient
   evidence); expect 409 and the Vet reason. Confirm BE did not create a program or assignment for the rejected request.
7. Verify ordinary 403 retains session; 401/inactive clears it; logout 204 clears the client session.

Current executed live result: health/me **CONNECTION REFUSED**. No live login/create/GET persistence/assignment/
LOCKED/template-immutability PASS is claimed. HTTP fixture tests and browser smoke are recorded separately.
