import type { ReactNode } from 'react';
import { Header, type HeaderProps } from './Header';
import { Sidebar } from './Sidebar';
import styles from './AppShell.module.css';

export interface AppShellProps extends HeaderProps {
  children: ReactNode;
}

/**
 * Desktop app shell used by every authenticated screen (Page 04 frames, e.g. SCR-ADMIN-001 288:3192):
 * Sidebar 240 | Main = Header 64 + Content (padding 32 on bg/page).
 * The role comes from `GET /api/auth/me` (wired by CORE-008/009); this component never decides access.
 */
export function AppShell({ children, ...headerProps }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar role={headerProps.user.role} />
      <div className={styles.main}>
        <Header {...headerProps} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
