import { Navigate } from 'react-router';
import { ROUTES } from '../app/routePaths';
import { primaryRole, useAuth } from '../shared/auth/authState';
import { GroomTodayPage } from '../features/groom/GroomTodayPage';
import { Card, EmptyState } from '../design-system';
import { PageHeader } from '../layout/PageHeader';

/** Role-resolving /dashboard (DEC-008 routing, DEC-009 §4 landings). */
export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  switch (primaryRole(user)) {
    case 'CLUB_MANAGER':
    case 'VETERINARIAN':
      return <Navigate to={ROUTES.horses} replace />;
    case 'HEAD_TRAINER':
    case 'TRAINER':
      return <Navigate to={ROUTES.trainingPrograms} replace />;
    case 'WORK_RIDER':
      return <Navigate to={ROUTES.myRides} replace />;
    case 'GROOM':
      return <GroomTodayPage />;
    default:
      return (
        <>
          <PageHeader title="My Horses" />
          <Card>
            <EmptyState title="Workspace not available in this demo" description="The Horse Owner workspace is outside the demonstrated main flow." />
          </Card>
        </>
      );
  }
}
