import { useNavigate } from 'react-router';
import { AppShell } from '../layout/AppShell';
import { Button } from '../design-system/components/Button/Button';
import { Card } from '../design-system/components/Card/Card';
import { ROUTES } from '../app/routePaths';
import { useAuth } from '../shared/auth/AuthProvider';
import { NAVIGATION } from '../layout/navigation';
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
      <Card title="Signed in">
        <p className="text-body">{user.fullName}</p>
        <p className="text-body">{user.email} · {user.userCode}</p>
      </Card>
    </AppShell>
  );
}
