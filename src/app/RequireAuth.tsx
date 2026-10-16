import { Navigate, useLocation } from 'react-router';
import { Button } from '../design-system/components/Button/Button';
import { ErrorState } from '../design-system/components/ErrorState/ErrorState';
import { ROUTES } from './routePaths';
import { useAuth } from '../shared/auth/AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <p role="status">Restoring your session…</p>;
  if (auth.status === 'anonymous') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  if (auth.status === 'error') {
    return (
      <main className="auth-problem">
        <ErrorState title="Workspace unavailable" description={auth.message ?? undefined} onRetry={() => void auth.restore()} />
        <Button variant="secondary" onClick={() => void auth.logout()}>
          Sign out
        </Button>
      </main>
    );
  }
  return children;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') return <p role="status">Restoring your session…</p>;
  if (auth.status === 'authenticated') return <Navigate to={ROUTES.dashboard} replace />;
  if (auth.status === 'error') return <RequireAuth>{children}</RequireAuth>;
  return children;
}
