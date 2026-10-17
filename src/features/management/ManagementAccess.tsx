import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ErrorState } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';

function RoleAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('CLUB_MANAGER')) {
    return <main className="auth-problem"><ErrorState title="Access denied" description="This page is available to Club Managers only." /><Link to={ROUTES.dashboard}>Back to workspace</Link></main>;
  }
  // A change of actor unmounts all data regions, preventing the previous account's data from being displayed.
  return <div key={user.id}>{children}</div>;
}

export function ManagementAccess({ children }: { children: ReactNode }) {
  return <RequireAuth><RoleAccess>{children}</RoleAccess></RequireAuth>;
}
