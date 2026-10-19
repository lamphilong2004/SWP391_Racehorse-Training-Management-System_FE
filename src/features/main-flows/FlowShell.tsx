import type { ReactNode } from 'react';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RoleCode } from '../../shared/auth/roles';
import styles from './flow.module.css';

export function FlowShell({ title, description, section, role, actions, children }: {
  title: string; description?: string; section: string; role: RoleCode; actions?: ReactNode; children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;
  return <AppShell user={{ fullName: user.fullName, role }} breadcrumb={[{ label: section }, { label: title }]}>
    <div className={styles.page}><div className={styles.heading}><div><h1 className="text-h1">{title}</h1>{description && <p className={styles.muted}>{description}</p>}</div>{actions}</div>{children}</div>
  </AppShell>;
}
