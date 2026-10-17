import { lazy, Suspense, type ComponentType } from 'react';
import { LoadingState } from '../design-system';

/** Integration-only loading boundary. Feature code, shared providers and outer role guards remain unchanged. */
function deferred(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return function DeferredPage() {
    return <Suspense fallback={<LoadingState label="Loading screen…" />}><Page /></Suspense>;
  };
}

export const ProgramCreationPage = deferred(() => import('../features/program-creation/ProgramCreationPage').then((m) => ({ default: m.ProgramCreationPage })));
export const SessionEvaluationPage = deferred(() => import('../features/evaluation/SessionEvaluationPage').then((m) => ({ default: m.SessionEvaluationPage })));
export const PerformancePage = deferred(() => import('../features/evaluation/PerformancePage').then((m) => ({ default: m.PerformancePage })));
export const GroomTodayPage = deferred(() => import('../features/precheck/pages').then((m) => ({ default: m.GroomTodayPage })));
export const PrecheckPage = deferred(() => import('../features/precheck/pages').then((m) => ({ default: m.PrecheckPage })));
export const RiderDashboardPage = deferred(() => import('../features/rider/lists').then((m) => ({ default: m.RiderDashboardPage })));
export const RiderAssignmentsPage = deferred(() => import('../features/rider/lists').then((m) => ({ default: m.RiderAssignmentsPage })));
export const RiderHistoryPage = deferred(() => import('../features/rider/lists').then((m) => ({ default: m.RiderHistoryPage })));
export const RiderAssignmentPage = deferred(() => import('../features/rider/assignment').then((m) => ({ default: m.RiderAssignmentPage })));
export const RiderSessionPage = deferred(() => import('../features/rider/session').then((m) => ({ default: m.RiderSessionPage })));
export const RiderFeedbackPage = deferred(() => import('../features/rider/feedback').then((m) => ({ default: m.RiderFeedbackPage })));
export const CaseListPage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.CaseListPage })));
export const CreateCasePage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.CreateCasePage })));
export const CaseDetailPage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.CaseDetailPage })));
export const TreatmentPlanPage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.TreatmentPlanPage })));
export const HerdHealthPage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.HerdHealthPage })));
export const IncidentListPage = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.IncidentListPage })));
export const VetIncidentReview = deferred(() => import('../features/medical/pages').then((m) => ({ default: m.VetIncidentReview })));
export const TreatmentTasksPage = deferred(() => import('../features/core046/pages').then((m) => ({ default: m.TreatmentTasksPage })));
export const IncidentsPage = deferred(() => import('../features/core046/pages').then((m) => ({ default: m.IncidentsPage })));
export const IncidentDetailPage = deferred(() => import('../features/core046/pages').then((m) => ({ default: m.IncidentDetailPage })));
