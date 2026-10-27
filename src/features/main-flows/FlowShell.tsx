import type { ReactNode } from 'react';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RoleCode } from '../../shared/auth/roles';
import styles from './flow.module.css';

export function FlowShell({ title, description, section, role, actions, children }: {
  title: string; description?: string; section: string; role: RoleCode; actions?: ReactNode; children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role }} breadcrumb={[{ label: section }, { label: title }]}>
    <div className={styles.page}><PageHeader title={title} description={description} actions={actions} />{children}</div>
  </AppShell>;
}
