import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../design-system/components/Button/Button';
import { ErrorState } from '../design-system/components/ErrorState/ErrorState';
import { ROUTES } from './routePaths';
import { useAuth } from '../shared/auth/AuthProvider';
import type { RoleCode } from '../shared/auth/roles';

export function RequireAuth({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: readonly RoleCode[] }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (auth.status === 'loading') return <p role="status">Đang khôi phục phiên đăng nhập…</p>;
  if (auth.status === 'anonymous') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  if (auth.status === 'error') {
    return (
      <main className="auth-problem">
        <ErrorState title="Không mở được không gian làm việc" description={auth.message ?? undefined} onRetry={() => void auth.restore()} />
        <Button variant="secondary" onClick={() => void auth.logout()}>
          Đăng xuất
        </Button>
      </main>
    );
  }
  if (allowedRoles && !auth.user?.roles.some((role) => allowedRoles.includes(role))) {
    return (
      <main className="auth-problem">
        <ErrorState title="Không có quyền truy cập" description="Tài khoản của bạn không có quyền truy cập trang này." />
        <Button variant="secondary" onClick={() => navigate(ROUTES.dashboard)}>Quay lại không gian làm việc</Button>
      </main>
    );
  }
  return children;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <p role="status">Đang khôi phục phiên đăng nhập…</p>;
  if (auth.status === 'authenticated') {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={from?.startsWith('/') ? from : ROUTES.dashboard} replace />;
  }
  if (auth.status === 'error') return <RequireAuth>{children}</RequireAuth>;
  return children;
}
