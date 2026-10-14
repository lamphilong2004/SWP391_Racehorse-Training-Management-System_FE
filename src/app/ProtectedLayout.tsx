import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { Button, ErrorState, LoadingState } from '../design-system';
import { AppShell } from '../layout/AppShell';
import { primaryRole, useAuth } from '../shared/auth/authState';
import type { RoleCode } from '../shared/auth/roles';
import { ROUTES } from './routePaths';
import styles from './ProtectedLayout.module.css';

export interface RouteHandle {
  crumb?: string;
  roles?: RoleCode[];
}

/** DEMO INTEGRATION: authenticated shell + frontend role guard (usability only — the backend enforces RBAC). */
export function ProtectedLayout() {
  const { status, user, logout } = useAuth();
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  if (status === 'loading') return <LoadingState label="Verifying your session…" />;
  if (status === 'anonymous' || !user) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  const role = primaryRole(user);
  const handles = matches.map((m) => m.handle as RouteHandle | undefined).filter(Boolean) as RouteHandle[];
  const allowed = handles.every((h) => !h.roles || h.roles.includes(role));
  const crumbs = handles.filter((h) => h.crumb).map((h) => ({ label: h.crumb as string }));
  return (
    <AppShell
      user={{ fullName: user.fullName, role }}
      breadcrumb={crumbs.length ? crumbs : [{ label: 'Home' }]}
      onUserMenuClick={() => {
        void logout().then(() => navigate(ROUTES.login, { replace: true }));
      }}
    >
      <div className={styles.content}>
        <div className={styles.topbar}>
          <span className={styles.who}>
            Signed in as <strong>{user.fullName}</strong>
          </span>
          <Button size="sm" variant="tertiary" onClick={() => void logout().then(() => navigate(ROUTES.login, { replace: true }))}>
            Sign out
          </Button>
        </div>
        {allowed ? (
          <Outlet />
        ) : (
          <ErrorState title="Access denied" description="Your role cannot open this screen." onRetry={() => navigate(ROUTES.dashboard)} retryLabel="Go to my workspace" />
        )}
      </div>
    </AppShell>
  );
}
