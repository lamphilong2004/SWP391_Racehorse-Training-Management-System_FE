# Flow 1–4 local release verification — 2026-11-03

This report records real local verification, not Independent Gate approval or a main release.
Leader requested Flow 1–4 verification and team delivery before completing Flow 5.

## Exact candidate and environment

- FE candidate: `5db63192e551247ead26e0451e27c4b3f82ecab0`, PR #33, base `main`. Application/config source is unchanged from the full-suite-tested `54a55f2c5ff38fc4dd997367c657ca3c98b5e096`; this report is documentation only.
- BE candidate: `dd9c800066883baa6120a0dc707afa7f019cbdf9`, BE PR #35, base `main`. Runtime implementation matches `173a8b0530beae2d0b034ed67b23def1f42243b0`; later commits are documentation only.
- Local API-only FE `http://localhost:5214`; BE `http://localhost:8080`; SQL Server `Racehorse_training`, strict JDBC TLS, JPA validate. No cloud deployment.
- Pinned runtime JAR SHA-256: `ef3d13b673f2076ccf4aa330fb7336250ced334431c9bac9b858f98b258c0a7d`.

## Fresh official API and SQL proof

Created one fictional verification horse, Thiên Lam (`VERIFY-1103-THIENLAM`, horse ID 9), using official APIs. All new operational and clinical notes explicitly identify simulated software-verification data. Existing horses, cases, accounts and stock records were not reset or overwritten.

| Flow | Fresh verified behavior |
|---|---|
| 1 | Club Manager creates DRAFT, declares fictional pedigree/current ownership/stable; Vet baseline automatically produces ACTIVE; Owner profile read and unauthorized create rejection. |
| 2 | Head Trainer template/program/Trainer assignment; Trainer suitability/session/Groom assignment; Groom ALL_NORMAL; assigned Rider start/complete/feedback; Trainer evaluation and result readback; Owner training summary. |
| 3 | Groom incident from the new care task; Vet review opens case, examination, treatment plan, LOCKED restriction; Groom completes assigned treatment task; restriction stays LOCKED; Owner cannot read clinical case. |
| 4 | Care/nutrition plans produce dated tasks; future completion denied; Groom completes today's tasks without stock deduction; manual receipt and replenishment; concurrent stock requests yield exactly one 201 and one 409; new future task reassignment/cancellation/history, stale writer rejection and old-Groom scope rejection. |

- Five scenario phases: 139 actual HTTP requests, 47 assertions, all PASS. Extra scope/exception checks: 36 HTTP requests and one assertion, all PASS. Combined: **175 HTTP requests / 48 assertions**. These counts exclude browser requests below.
- Independent strict-TLS SELECT-only verification: **14/14 persisted-state assertions PASS** plus live schema/package checksum verification PASS. Completed session, precheck, feedback, evaluation, ownership/stable, medical case/restriction, completed care/treatment and stock ledger were independently read from SQL.
- New IDs: program 3, completed session 4, medical case 6, care/nutrition plans 8/8, inventory item 2. These are evidence references, not IDs hardcoded into application behavior.
- Rejected expired-session start was correctly identified as a time-gate check. It is not mislabeled as a fresh abnormal-precheck test. Earlier abnormal-precheck evidence remains separate.

## Fresh browser proof and retained regression evidence

- Seven real account logins, **15 role/route combinations and 30 open/refresh checks PASS**. New persisted horse/task/program/case/stock data rendered after refresh. Zero captured page/console errors, HTTP failures or horizontal overflow at 1440px. Temporary browser closed.
- Browser business mutations: zero. Workflow writes above were performed by actual HTTP APIs, followed by browser rendering/refresh and independent SQL checks; this is **not** a claim that every workflow form was submitted in the browser.
- Smoke harness corrections: inventory must assert its new stock item rather than a horse name; identity requests must finish before checking names; selectors must not resolve to hidden filter options. These were harness errors, not product fixes or relaxed business assertions.
- Retained unchanged-source checks: FE 1073/1073 tests (96 files), lint, typecheck, production build, bundle guard and 13 policy checks PASS. Earlier seven-role UI audit: 103 role/routes and 412 viewport checks PASS; 48 form/modal checks PASS. Backend focused 20/20 tests/build PASS, distinct from SQL proof above.
- Private receipts, screenshots, credentials and logs remain outside Git. No credentials, tokens, authorization headers or SQL secrets belong in this report.

## Release limits

No exhaustive claim about every business exception or concurrency path. New verification data remains in the review database; no reset, migration, SQL configuration change or account change occurred. Flow 5 work is held separately on a local feature branch and is absent from these candidates and runtime.

FE PR #33 still requires an approving review under GitHub protection. BE PR #35 needs independent project review despite a clean merge state. Both are Ready for Review. Do not bypass these gates or claim either main is updated. Use merge commits after valid approval, preserving existing contributor history.
