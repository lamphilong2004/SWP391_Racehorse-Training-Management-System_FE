# Enterprise UI V4

Baseline: FE main `985808c90a8f9c5cba018a6b58a5f6c462ebd9dd`. Branch: `design/enterprise-ui-v4`.
This branch changes presentation and existing filter controls. It does not change backend code, schema, API clients, JWT, RBAC, navigation or workflow transitions.

## Design decisions

Navy retains identity and hierarchy. Emerald identifies primary actions and selected navigation. Sky and violet distinguish informational surfaces and KPI groups. Amber/rose remain semantic warnings/errors; statuses retain text/icons. Darker emerald and sky values are used for small text/white-label actions, with automated contrast checks. Inter and Plus Jakarta Sans remain self-hosted. Reduced-motion tokens and original focus controls remain active.

References inspected: [Fluent 2](https://fluent2.microsoft.design/), [Atlassian dynamic tables](https://atlassian.design/components/dynamic-table/), [Polaris table filters](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table), [Linear](https://linear.app/), [Stripe search](https://docs.stripe.com/dashboard/search), and approved Racehorse Stitch/V3. These informed hierarchy, persistent filter context and compact data presentation; no assets or proprietary code were copied.

## Implemented

- Shared tokens, action colors, sidebar selection, card headings, KPI surfaces, tabs, charts and table styling.
- Keyboard-accessible table scrolling; long text wraps inside cells. Redundant outer scroll landmarks removed where present.
- Controlled `TableToolbar`: requests remain feature-owned; server/current-page scope and exact supplied counts are explicit. Adopted in Horse registry, Users, Medical cases, Incidents and Template Library.
- Horse identity/code hierarchy, breed/age/sex, stable/action widths. A DRAFT horse explicitly remains operationally unready even when availability is AVAILABLE.
- Staff experience/skill grouping, responsive field widths and skill surfaces; fields/validation/payloads preserved.
- Training list clear-all actions, accurate shown-row versus server-total counts. Existing mixed filtering scopes remain explained.
- Medical care panels use restrained violet/sky accents; clinical permissions/status semantics remain unchanged.

`ENTERPRISE-TABLE-INVENTORY.json` enumerates every feature table occurrence. Fixed phase-input, role catalog, planned/actual and single-session measurement tables retain meaningful fixed order, rather than arbitrary search/sort controls. No unsupported server filtering or sorting was introduced.

## Verification and limits

Real local presentation backend: separate loopback port 18091; original 8080 process/database preserved. UI: port 5214 in this same application/worktree.
The source database was backed up before creating the isolated presentation database. SQL data tooling and local credentials are outside this repository and production artifacts.

The five requested handoff reports are retained in workspace `Racehorse-Enterprise-V4/`; detailed evidence remains in `_gate-monitor/enterprise-v4/`. Seven-role navigation, real filtering, persisted Groom precheck, Rider start/complete/feedback and Trainer evaluation have been exercised. Owner Profile/Health/Training tabs, Vet case/treatment detail and fully loaded herd-health data were additionally checked at source HEAD `5f35d5eaee03b2a6a1449c7b32a1a9bce405a6de`. This is not blanket verification of every modal, drawer, viewport and error combination.

Horse registry and herd-health actual viewport measurements: 1440×900, 1280×800, 1024×768 and 390×844, with no document-level horizontal overflow observed. Browser zoom keyboard commands did not change measured scaling: 125% zoom remains UNVERIFIED. Other screens require their own measured coverage before claiming complete responsive verification.

Full-suite and exact candidate evidence are recorded in `TEST_REPORT.md`; no main merge or deployment is performed by this task. The controlled comparison uses untouched main `985808c` and V4 against the same backend, account, seven SQL Horse records, port and 1440×900 viewport. Files are `assets/horses-v3-same-data.png` and `assets/horses-v4-same-data.png` in the local handoff. Earlier historical screenshots are not substituted for this comparison.

## Role coverage

| Role | Actual observed coverage | Boundary |
|---|---|---|
| Club Manager | Dashboard, Horse registry, pending activation, users, registrations, roles, audit; refined staff form | No existing source accounts or records changed |
| Head Trainer | Programs, templates, adjustment requests, schedule, performance, monitoring, medical summaries/restrictions | Workflow setup and decision persisted through APIs; not every wizard was clicked |
| Trainer | Assigned programs, calendar, exercises, performance, restrictions; result/planned-actual/evaluation | Evaluation saved and verified after refresh in browser |
| Work Rider | Assignments, history, readiness, active session and feedback | Actual start/complete/feedback persisted; LOCKED scenario remains blocked |
| Groom | Today's work, care tasks, incidents; all-normal precheck | Browser precheck persisted after refresh; exception/care completion verified API/SQL |
| Veterinarian | Horse arrivals, medical registry, incident registry, herd health, case/treatment tabs | Explicit simulated observation-only care; restriction retained |
| Horse Owner | Owned list and Profile/Health/Training tabs, notifications | Read-only summaries; clinical detail is not exposed |

## Table audit

Source inventory finds 25 table occurrences in 19 feature modules. Horse, staff and template filtering uses existing server parameters. Medical cases/incidents explicitly filter only the loaded page. Training retains its existing mixed scope and reports shown rows separately from the server total. No new sorting parameter was invented. Fixed role matrices, planned/actual comparisons and wizard workload inputs retain their meaningful fixed order.

Empty/one/many-row, long-value, slow/failing-response checks are component fixture evidence. The actual SQL Horse dataset has seven records. All seven roles use the same shared V4 surfaces; this report does not certify every route/state combination as visually inspected.
