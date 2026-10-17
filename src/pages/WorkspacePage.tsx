import { useNavigate } from 'react-router';
import { AppShell } from '../layout/AppShell';
import { Button } from '../design-system/components/Button/Button';
import { Card } from '../design-system/components/Card/Card';
import { ROUTES } from '../app/routePaths';
import { useAuth } from '../shared/auth/AuthProvider';
import { NAVIGATION } from '../layout/navigation';
import { Link } from 'react-router';
import styles from './WorkspacePage.module.css';

export function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const role = user.roles[0];
  return (
    <AppShell user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Dashboard' }]}>
      <div className={styles.heading}>
        <div>
          <h1 className="text-h1">{NAVIGATION[role].workspaceLabel}</h1>
          <p className="text-body">Your authenticated workspace is ready.</p>
        </div>
        <Button variant="secondary" onClick={async () => { await logout(); navigate(ROUTES.login, { replace: true }); }}>
          Sign out
        </Button>
      </div>
      {user.roles.includes('HEAD_TRAINER') && (
        <Button onClick={() => navigate(ROUTES.trainingProgramCreate)}>Create program</Button>
      )}
      {user.roles.includes('CLUB_MANAGER') && <Card title="Horse management"><Link to="/horses">Horse register</Link> · <Link to="/horses/new">Register Horse</Link> · <Link to="/horses/pending-activation">Pending Activation</Link></Card>}
      {user.roles.includes('TRAINER') && <Card title="Session results"><Link to="/training/sessions/42/evaluation">Result, Evaluation & History</Link></Card>}
      {user.roles.includes('VETERINARIAN') && <Card title="Medical"><Link to="/medical">Medical cases</Link> · <Link to="/medical/herd-health">Herd health</Link> · <Link to="/incidents">Incident review</Link></Card>}
      {user.roles.includes('GROOM') && <Card title="Groom workspace"><Link to="/groom/today">Today & prechecks</Link> · <Link to="/medical/my-tasks">Treatment tasks</Link> · <Link to="/incidents">Incidents</Link></Card>}
      {user.roles.includes('WORK_RIDER') && <Card title="My rides"><Link to="/rider">Today’s rides & assignments</Link></Card>}
      <Card title="Signed in">
        <p className="text-body">{user.fullName}</p>
        <p className="text-body">{user.email} · {user.userCode}</p>
      </Card>
    </AppShell>
  );
}
