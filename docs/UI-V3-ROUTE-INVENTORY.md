# UI v3 route and shared-style inventory

Source baseline: `55f85518b7422e3cc32f8953fa3877ad6fe37ef4`. Generated from actual route declarations; no routes or guards changed.

Found 76 distinct path/view declarations (includes aliases, development and conditional login entries; not a claim of 76 independent screens). Tabs, modals, loading/error states and role projections are additional states. Runtime visual verification is required after each approved batch.

First approval batch: `/login`, `/horses`, `/horses/new`. The existing identity-edit route shares Registration rendering and styling; its read/update logic remains untouched. Other screens retain v1/v2. Role-test sign-in is unchanged and remains non-production.

Stitch supplies the global visual language, not a required frame for every route.
After three-screen approval, infer presentation from each existing screen pattern
while preserving its exact content, actions, API, state transitions and guards.

| Route / pattern | Existing view | Guard evidence | Source | V3 status |
|---|---|---|---|---|
| `/dev/foundation-v2` | Lazy import | Parent / feature guard; see source | src/app/router.tsx:37 | Pending visual approval; unchanged |
| `/dev/components` | Lazy import | Parent / feature guard; see source | src/app/router.tsx:41 | Pending visual approval; unchanged |
| `/dev/shell/:role` | Lazy import | Parent / feature guard; see source | src/app/router.tsx:45 | Pending visual approval; unchanged |
| `/login` | Lazy import | Parent / feature guard; see source | src/app/router.tsx:58 | First visual batch |
| `/login` | LoginPage | Public only | src/app/router.tsx:62 | First visual batch |
| `/` | Navigate | Parent / feature guard; see source | src/app/router.tsx:65 | Pending visual approval; unchanged |
| `/` | LandingPage | Public only | src/app/router.tsx:66 | Pending visual approval; unchanged |
| `/dashboard` | ManagementDashboardEntry | Parent / feature guard; see source | src/app/router.tsx:68 | Pending visual approval; unchanged |
| `/admin/audit-log` | ManagementAuditEntry | CLUB_MANAGER | src/app/router.tsx:69 | Pending visual approval; unchanged |
| `/account` | AccountPage | Parent / feature guard; see source | src/app/router.tsx:70 | Pending visual approval; unchanged |
| `/admin/users` | UserListPage | CLUB_MANAGER | src/app/router.tsx:71 | Pending visual approval; unchanged |
| `/admin/users/new` | UserEditorPage | CLUB_MANAGER | src/app/router.tsx:72 | Pending visual approval; unchanged |
| `/admin/users/:id/edit` | UserEditorPage | CLUB_MANAGER | src/app/router.tsx:73 | Pending visual approval; unchanged |
| `/admin/roles` | RolesPage | CLUB_MANAGER | src/app/router.tsx:74 | Pending visual approval; unchanged |
| `/notifications` | NotificationsPage | Parent / feature guard; see source | src/app/router.tsx:75 | Pending visual approval; unchanged |
| `/horses` | HorseListPage | Parent / feature guard; see source | src/app/router.tsx:81 | First visual batch |
| `/horses/:id` | HorseProfilePage | Parent / feature guard; see source | src/app/router.tsx:82 | Pending visual approval; unchanged |
| `/horses/new` | RegisterHorsePage | CLUB_MANAGER | src/app/router.tsx:83 | First visual batch |
| `/horses/:id/identity` | RegisterHorsePage | CLUB_MANAGER | src/app/router.tsx:84 | Pending visual approval; unchanged |
| `/horses/:id/edit` | PedigreeOwnershipPage | CLUB_MANAGER | src/app/router.tsx:85 | Pending visual approval; unchanged |
| `/horses/pending-activation` | PendingActivationPage | CLUB_MANAGER | src/app/router.tsx:86 | Pending visual approval; unchanged |
| `/training/programs/new` | ProgramCreationPage | HEAD_TRAINER | src/app/router.tsx:88 | Pending visual approval; unchanged |
| `/training/templates` | TemplateLibraryPage | HEAD_TRAINER | src/app/router.tsx:89 | Pending visual approval; unchanged |
| `/horses/:id/baseline` | BaselinePage | VETERINARIAN | src/app/router.tsx:90 | Pending visual approval; unchanged |
| `/medical/restrictions` | RestrictionsPage | VETERINARIAN, HEAD_TRAINER, TRAINER, CLUB_MANAGER | src/app/router.tsx:91 | Pending visual approval; unchanged |
| `/training/monitoring` | LiveMonitoringPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER | src/app/router.tsx:92 | Pending visual approval; unchanged |
| `/training/programs/assigned` | AssignedProgramsPage | TRAINER | src/app/router.tsx:93 | Pending visual approval; unchanged |
| `/training/schedule` | TrainingCalendarPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER | src/app/router.tsx:94 | Pending visual approval; unchanged |
| `/training/calendar` | TrainingCalendarPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER | src/app/router.tsx:95 | Pending visual approval; unchanged |
| `/training/exercise-library` | ExerciseLibraryPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER, WORK_RIDER | src/app/router.tsx:96 | Pending visual approval; unchanged |
| `/training/exercise-library/new` | ExerciseLibraryPage | TRAINER | src/app/router.tsx:97 | Pending visual approval; unchanged |
| `/training/exercises` | ExerciseLibraryPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER, WORK_RIDER | src/app/router.tsx:98 | Pending visual approval; unchanged |
| `/training/adjustment-requests` | AdjustmentRequestsPage | HEAD_TRAINER, TRAINER | src/app/router.tsx:99 | Pending visual approval; unchanged |
| `/training/programs/:id` | ProgramDetailPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER, GROOM | src/app/router.tsx:100 | Pending visual approval; unchanged |
| `/training/session/:id` | SessionDetailPage | TRAINER, HEAD_TRAINER, VETERINARIAN, CLUB_MANAGER | src/app/router.tsx:101 | Pending visual approval; unchanged |
| `/training/schedule/session/new` | CreateSessionPage | TRAINER | src/app/router.tsx:102 | Pending visual approval; unchanged |
| `/training/sessions/:id/evaluation` | SessionEvaluationPage | Parent / feature guard; see source | src/app/router.tsx:103 | Pending visual approval; unchanged |
| `/training/performance` | PerformancePage | HEAD_TRAINER, TRAINER, CLUB_MANAGER, VETERINARIAN | src/app/router.tsx:104 | Pending visual approval; unchanged |
| `/groom/today` | GroomTodayPage | GROOM | src/app/router.tsx:105 | Pending visual approval; unchanged |
| `/training/my-sessions/:id/pre-check` | PrecheckPage | GROOM | src/app/router.tsx:106 | Pending visual approval; unchanged |
| `/rider` | RiderDashboardPage | WORK_RIDER | src/app/router.tsx:107 | Pending visual approval; unchanged |
| `/rider/assignments` | RiderAssignmentsPage | WORK_RIDER | src/app/router.tsx:108 | Pending visual approval; unchanged |
| `/rider/assignments/:id` | RiderAssignmentPage | WORK_RIDER | src/app/router.tsx:109 | Pending visual approval; unchanged |
| `/rider/assignments/:id/start` | RiderAssignmentPage | WORK_RIDER | src/app/router.tsx:110 | Pending visual approval; unchanged |
| `/rider/sessions/:id/active` | RiderSessionPage | WORK_RIDER | src/app/router.tsx:111 | Pending visual approval; unchanged |
| `/rider/sessions/:id/feedback` | RiderFeedbackPage | WORK_RIDER | src/app/router.tsx:112 | Pending visual approval; unchanged |
| `/rider/history` | RiderHistoryPage | WORK_RIDER | src/app/router.tsx:113 | Pending visual approval; unchanged |
| `/training/my-sessions` | GroomTodayPage | GROOM | src/app/router.tsx:115 | Pending visual approval; unchanged |
| `/training/my-rides` | RiderDashboardPage | WORK_RIDER | src/app/router.tsx:116 | Pending visual approval; unchanged |
| `/training/rides/assigned` | RiderAssignmentsPage | WORK_RIDER | src/app/router.tsx:117 | Pending visual approval; unchanged |
| `/training/rides/history` | RiderHistoryPage | WORK_RIDER | src/app/router.tsx:118 | Pending visual approval; unchanged |
| `/training/rides/:id` | RiderAssignmentPage | WORK_RIDER | src/app/router.tsx:119 | Pending visual approval; unchanged |
| `/training/rides/:id/start` | RiderAssignmentPage | WORK_RIDER | src/app/router.tsx:120 | Pending visual approval; unchanged |
| `/training/rides/:id/execute` | RiderSessionPage | WORK_RIDER | src/app/router.tsx:121 | Pending visual approval; unchanged |
| `/training/rides/:id/feedback` | RiderFeedbackPage | WORK_RIDER | src/app/router.tsx:122 | Pending visual approval; unchanged |
| `/rides` | Navigate | Parent / feature guard; see source | src/app/router.tsx:123 | Pending visual approval; unchanged |
| `/rides/assignments` | Navigate | Parent / feature guard; see source | src/app/router.tsx:124 | Pending visual approval; unchanged |
| `/rides/history` | Navigate | Parent / feature guard; see source | src/app/router.tsx:125 | Pending visual approval; unchanged |
| `/rides/report-issue` | Navigate | Parent / feature guard; see source | src/app/router.tsx:126 | Pending visual approval; unchanged |
| `/medical` | MedicalAccess, CaseListPage | Parent / feature guard; see source | src/app/router.tsx:127 | Pending visual approval; unchanged |
| `/medical/cases/new` | MedicalAccess, CreateCasePage | Parent / feature guard; see source | src/app/router.tsx:128 | Pending visual approval; unchanged |
| `/medical/cases/:caseId` | MedicalAccess, CaseDetailPage | Parent / feature guard; see source | src/app/router.tsx:129 | Pending visual approval; unchanged |
| `/medical/cases/:caseId/treatment-plan` | MedicalAccess, TreatmentPlanPage | Parent / feature guard; see source | src/app/router.tsx:130 | Pending visual approval; unchanged |
| `/medical/herd-health` | MedicalAccess, HerdHealthPage | Parent / feature guard; see source | src/app/router.tsx:131 | Pending visual approval; unchanged |
| `/medical/summary` | MedicalSummaryAccess | Parent / feature guard; see source | src/app/router.tsx:132 | Pending visual approval; unchanged |
| `/care/tasks` | GroomTreatmentAccess | Parent / feature guard; see source | src/app/router.tsx:133 | Pending visual approval; unchanged |
| `/medical/my-tasks` | Navigate | Parent / feature guard; see source | src/app/router.tsx:134 | Pending visual approval; unchanged |
| `/incidents` | IncidentAccess | Parent / feature guard; see source | src/app/router.tsx:135 | Pending visual approval; unchanged |
| `/incidents/:incidentId` | IncidentAccess | Parent / feature guard; see source | src/app/router.tsx:136 | Pending visual approval; unchanged |
| `/training/programs` | ProgramListPage | HEAD_TRAINER | src/app/router.tsx:138 | Pending visual approval; unchanged |
| `*` | NotFoundPage | Parent / feature guard; see source | src/app/router.tsx:139 | Pending visual approval; unchanged |
| `/register` | RegisterPage | Public only | src/features/registration/routes.tsx:8 | Pending visual approval; unchanged |
| `/forgot-password` | ForgotPasswordPage | Public only | src/features/registration/routes.tsx:10 | Added 2026-10-22 (DEC-008 R9 contract); V3 auth layout |
| `/reset-password` | ResetPasswordPage | Public only | src/features/registration/routes.tsx:11 | Added 2026-10-22 (DEC-008 R9; dev outbox link target); V3 auth layout |
| `/admin/registrations` | RegistrationReviewPage | Parent / feature guard; see source | src/features/registration/routes.tsx:9 | Pending visual approval; unchanged |
| `/owner/horses` | OwnerPage | HORSE_OWNER (parent) | src/features/owner/ownerRoutes.tsx:7 | Pending visual approval; unchanged |
| `/owner/horses/:horseId` | OwnerPage | HORSE_OWNER (parent) | src/features/owner/ownerRoutes.tsx:8 | Pending visual approval; unchanged |
| `/my-horses, /my-horses/:id` | LegacyOwnerLink redirect | HORSE_OWNER | src/features/owner/ownerApplicationRoutes.tsx:20 | Pending visual approval; unchanged |

## Shared components reused

AlertBanner, Breadcrumb, Button, CandidateCard, Card, ChartContainer, Checkbox, DataTable, EmptyState, ErrorState, Field, Foundation, HorseCard, KeyValue, LoadingState, MetricCard, NotificationItem, Overlay, PhotoAttachmentTile, RadioGroup, SelectField, Skeleton, StableBoxTile, StatusBadge, Tabs, TextAreaField, TextField, Toast, UnsavedChangesGuard, ValidationNotice, WizardStepper.

First batch changes token inheritance, self-hosted heading fonts, Button/Field/Table/MetricCard styles and the existing Sidebar/Header CSS. Existing Card styles receive radius/elevation tokens. Existing Badge semantic status colours and Overlay/UnsavedChangesGuard behaviour are retained. Tabs, charts, other feature CSS and additional dialog styling await the three-screen approval. No new business controls or sample records are introduced.
