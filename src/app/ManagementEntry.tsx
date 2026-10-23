import { lazy, Suspense } from 'react';
import { LoadingState } from '../design-system';
import { WorkspacePage } from '../pages/WorkspacePage';
import { useAuth } from '../shared/auth/AuthProvider';
import { TrainerDashboardPage } from './DeferredPages';

const Dashboard = lazy(() => import('../features/management/IntegratedManagement').then((module) => ({ default: module.ManagementDashboard })));
const Audit = lazy(() => import('../features/management/IntegratedManagement').then((module) => ({ default: module.ManagementAudit })));

export function ManagementDashboardEntry() {
  const { user } = useAuth();
  return user?.roles.includes('CLUB_MANAGER')
    ? <Suspense fallback={<LoadingState label="Đang tải không gian quản lý…" />}><Dashboard /></Suspense>
    : user?.roles.includes('TRAINER') ? <TrainerDashboardPage /> : <WorkspacePage />;
}

export function ManagementAuditEntry() {
  return <Suspense fallback={<LoadingState label="Đang tải nhật ký hệ thống…" />}><Audit /></Suspense>;
}
