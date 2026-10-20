import type { ReactNode } from 'react';
import { AlertBanner, EmptyState, ErrorState, LoadingState } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { errorMessage } from './data';
export function RiderShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.roles.includes('WORK_RIDER')) return <AlertBanner type="danger" title="Access denied">Only Work Riders may use this workspace.</AlertBanner>;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: 'WORK_RIDER' }} breadcrumb={[{ label: 'My Rides', to: '/rider' }, { label: 'Work Rider' }]}>{children}</AppShell>;
}
export function ReadState({ error, loading, retry }: { error?: unknown; loading: boolean; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Access denied">This ride is outside your permitted scope. Your session remains active.</AlertBanner>;
  if (error instanceof ApiError && error.status === 404) return <EmptyState title="Ride not found" description="The requested ride is not available." />;
  if (error) return <ErrorState title="Ride data unavailable" description={errorMessage(error)} onRetry={retry} />;
  return loading ? <LoadingState label="Loading your ride…" /> : null;
}
