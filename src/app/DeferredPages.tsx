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
export const ProgramListPage = deferred(() => import('../features/program-creation/ProgramListPage').then((m) => ({ default: m.ProgramListPage })));
export const ProgramDetailPage = deferred(() => import('../features/program-creation/ProgramDetailPage').then((m) => ({ default: m.ProgramDetailPage })));
export const AdjustmentRequestsPage = deferred(() => import('../features/program-creation/AdjustmentRequestsPage').then((m) => ({ default: m.AdjustmentRequestsPage })));
export const BaselinePage = deferred(() => import('../features/baseline/BaselinePage').then((m) => ({ default: m.BaselinePage })));
export const TrainerDashboardPage = deferred(() => import('../features/trainer-session/TrainerDashboardPage').then((m) => ({ default: m.TrainerDashboardPage })));
export const CreateSessionPage = deferred(() => import('../features/trainer-session/CreateSessionPage').then((m) => ({ default: m.CreateSessionPage })));
export const SessionDetailPage = deferred(() => import('../features/trainer-session/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })));
export const RestrictionsPage = deferred(() => import('../features/restrictions/RestrictionsPage').then((m) => ({ default: m.RestrictionsPage })));
export const LiveMonitoringPage = deferred(() => import('../features/live-monitoring/LiveMonitoringPage').then((m) => ({ default: m.LiveMonitoringPage })));
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
export const UserListPage = deferred(() => import('../features/administration/UserPages').then((m) => ({ default: m.UserListPage })));
export const UserEditorPage = deferred(() => import('../features/administration/UserPages').then((m) => ({ default: m.UserEditorPage })));
export const RolesPage = deferred(() => import('../features/administration/UserPages').then((m) => ({ default: m.RolesPage })));
export const NotificationsPage = deferred(() => import('../features/administration/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
