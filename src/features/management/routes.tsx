import { useAuth } from '../../shared/auth/AuthProvider';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { AuditLogPage } from './AuditLogPage';
import { ClubManagerDashboardPage } from './ClubManagerDashboardPage';

function DashboardForRole() {
  const { user } = useAuth();
  return user?.roles.includes('CLUB_MANAGER') ? <ClubManagerDashboardPage /> : <WorkspacePage />;
}

/** Leader integration: use at the existing /dashboard entry; preserve every other role's workspace. */
export function ClubManagerDashboardEntry() { return <RequireAuth><DashboardForRole /></RequireAuth>; }

/** Leader integration: append before the shared wildcard. Navigation already defines this canonical route. */
// eslint-disable-next-line react-refresh/only-export-components
export const core052AuditRoute = { path: ROUTES.auditLog, element: <AuditLogPage /> };
