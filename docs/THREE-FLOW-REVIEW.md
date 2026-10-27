# Review the three main flows locally

Scope confirmed by the Leader on 2026-10-27. Daily stable cleaning is saved separately for a later delivery. It is not required for this review and does not replace session prechecks.

FE: http://localhost:5173/login. BE: http://localhost:8080. Existing presentation database: racehorse_presentation_20261023. Use the existing local role accounts; do not create/reset accounts or move historical dates to make a scenario pass.

## Data and responsibilities

| Flow | Role and entry | Persisted progression |
| --- | --- | --- |
| Horse registration | Club Manager: `/horses/new`, then `/horses/{id}/edit` | Create DRAFT identity; declare pedigree/owner and assign an available stable box. |
| Initial baseline | Veterinarian: horse profile → initial baseline, `/horses/{id}/baseline` | Record real observations; the server activates automatically after all mandatory registration conditions are satisfied. |
| Program | Head Trainer: `/training/programs/new` | Select ACTIVE horse/template, set program/phase dates and assign Trainer. The template remains unchanged. |
| Session planning | Trainer: assigned programs → create session | Use dates within the program/phase. Select eligible Rider, save and explicitly assign Groom. |
| Precheck | Groom: `/groom/today` | Open the assigned session on its scheduled Vietnam calendar day and save all checklist items. ALL_NORMAL permits the remaining start gates to be checked; ABNORMAL blocks start. |
| Execution/evaluation | Work Rider: `/rider/assignments`; Trainer: session result/evaluation | Start only after the scheduled time and passing gates; complete or interrupt honestly; submit feedback; Trainer saves the evaluation. |
| Medical exception | Incident → Veterinarian `/medical` → case/treatment plan | Vet reviews the case and restrictions, assigns Groom treatment tasks. Completing a task never automatically lifts a restriction. |
| Owner readback | Horse Owner: `/owner/horses` | Read the same owned horse's authorized profile, health and training summaries. Clinical permissions remain enforced. |

All roles read the same SQL entities through real APIs. A program does not automatically assign every horse to a Groom. Groom visibility requires an explicit session/task assignment and the appropriate date.

## Calendar for a new review scenario

- Use the Vietnam calendar day shown by the current system, not a hardcoded January/October sample date.
- New programs may start today; choose phase dates inside that program. There is no imposed six-month maximum.
- Sessions must start strictly in the future. A later time today is allowed. Their end must remain inside both the phase and program.
- Assigning Groom for a future session checks the Trainer assignment on that session's date, so advance preparation does not incorrectly require the assignment to have begun today.
- To demonstrate start, schedule a short time ahead, complete the precheck and wait until the actual start time. Do not disable the start gate or backdate a new session.
- For an old SCHEDULED session, the Trainer must choose a valid future time before editing/saving schedule details. Historical results remain readable.
- Groom Today follows Vietnam midnight automatically; a deliberately selected historical/future date is retained until choosing Hôm nay.

## Evidence and limits

Focused FE tests cover program/session date boundaries, editing/retry, role-specific screens and calendar rollover. TypeScript, ESLint, production build and bundle-isolation checks are recorded in the workspace checkpoint.

Read-only SQL inspection found 4 overdue SCHEDULED sessions, 1 SCHEDULED session without assigned Groom and 2 without precheck on 2026-10-27. These are separate counts and must not be added as distinct sessions. No records were changed. A past program start may simply mean a valid ongoing program.

Automated H2/API fixtures are not full browser-to-SQL E2E proof. This batch does not claim that all three journeys have been re-run with every role. Late-start expiry, precheck freshness and horse-wide overlap/recovery policy remain separate decisions; see the BE calendar-rule report. Main branches and all existing data are preserved.
