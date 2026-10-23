import type { ReactNode } from 'react';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, ErrorState } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';

function RoleAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('CLUB_MANAGER')) {
    return <main className="auth-problem"><ErrorState title="Không có quyền truy cập" description="Trang này chỉ dành cho Club Manager." /><ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Quay lại không gian làm việc</ButtonLink></main>;
  }
  // A change of actor unmounts all data regions, preventing the previous account's data from being displayed.
  return <div key={user.id}>{children}</div>;
}

export function ManagementAccess({ children }: { children: ReactNode }) {
  return <RequireAuth><RoleAccess>{children}</RoleAccess></RequireAuth>;
}
