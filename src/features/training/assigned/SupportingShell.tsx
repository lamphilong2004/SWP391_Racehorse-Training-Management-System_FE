import type { ReactNode } from 'react';
import { AlertBanner, EmptyState, ErrorState, LoadingState } from '../../../design-system';
import { AppShell } from '../../../layout/AppShell';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import type { RoleCode } from '../../../shared/auth/roles';
import { supportingError } from './supportingHooks';
export function SupportingShell({ title, roles, children }: { title: string; roles: readonly RoleCode[]; children: ReactNode }) {
  const { user } = useAuth(); const role = user?.roles.find((candidate) => roles.includes(candidate));
  if (!user || !role) return <AlertBanner type="danger" title="Access denied">Your role cannot use this training page.</AlertBanner>;
  return <AppShell user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Training' }, { label: title }]}>{children}</AppShell>;
}
export function SupportingReadState({ loading, error, retry }: { loading: boolean; error?: unknown; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Access denied">The server denied access to this data. Your session remains active.</AlertBanner>;
  if (error instanceof ApiError && error.status === 404) return <EmptyState title="Data not found" description="The requested training data is not available." />;
  if (error) return <ErrorState title="Training data unavailable" description={supportingError(error)} onRetry={retry} />;
  return loading ? <LoadingState label="Loading training data…" /> : null;
}
