import { Link } from 'react-router';
import { EmptyState } from '../design-system';
import { AppShell } from '../layout/AppShell';
import { useAuth } from '../shared/auth/AuthProvider';
import styles from './OwnerHandoffPage.module.css';

/**
 * Route handoff only: an explicit "not available in this build" state for sidebar/workbook routes whose owning CORE
 * screen is not integrated yet. It never replaces that screen, implies completion or performs mutations.
 */
export function OwnerHandoffPage({ title, section = 'Training' }: { title: string; section?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <AppShell user={{ fullName: user.fullName, role: user.roles[0] }} breadcrumb={[{ label: section }, { label: title }]}>
    <div className={styles.stack}>
      <EmptyState title={`${title} unavailable`} description="This screen is not available in this build." />
      <Link className={styles.link} to="/dashboard">Back to workspace</Link>
    </div>
  </AppShell>;
}
