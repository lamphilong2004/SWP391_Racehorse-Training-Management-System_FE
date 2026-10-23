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

Browser evidence and the five requested handoff reports are retained in workspace `_gate-monitor/enterprise-v4/`. Seven-role navigation, real filtering, persisted Groom precheck, Rider start/complete/feedback and Trainer evaluation have been exercised. This is not blanket verification of every modal, drawer, viewport and error combination.

Horse registry actual viewport measurements: 1440×900, 1280×800, 1024×768 and 390×844, with no document-level horizontal overflow observed. Browser zoom keyboard commands did not change measured scaling: 125% zoom remains UNVERIFIED. Other screens require their own measured coverage before claiming complete responsive verification.

Full-suite and exact candidate evidence are recorded in `TEST_REPORT.md`; no main merge or deployment is performed by this task. Screenshots distinguish historical V3 reference captures from the current isolated dataset; differing record counts are not visual regressions.
