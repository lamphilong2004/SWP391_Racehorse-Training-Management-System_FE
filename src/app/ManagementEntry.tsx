import { lazy, Suspense } from 'react';
import { LoadingState } from '../design-system';
import { WorkspacePage } from '../pages/WorkspacePage';
import { useAuth } from '../shared/auth/AuthProvider';

const Dashboard = lazy(() => import('../features/management/IntegratedManagement').then((module) => ({ default: module.ManagementDashboard })));
const Audit = lazy(() => import('../features/management/IntegratedManagement').then((module) => ({ default: module.ManagementAudit })));

export function ManagementDashboardEntry() {
  const { user } = useAuth();
  return user?.roles.includes('CLUB_MANAGER')
    ? <Suspense fallback={<LoadingState label="Loading management workspace…" />}><Dashboard /></Suspense>
    : <WorkspacePage />;
}

export function ManagementAuditEntry() {
  return <Suspense fallback={<LoadingState label="Loading audit viewer…" />}><Audit /></Suspense>;
}
