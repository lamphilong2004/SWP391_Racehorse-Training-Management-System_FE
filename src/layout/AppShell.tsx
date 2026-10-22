import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Header, type HeaderProps } from './Header';
import { Sidebar } from './Sidebar';
import styles from './AppShell.module.css';
import { AlertBanner } from '../design-system';
import { businessDataMode } from '../shared/data/businessData';
import { ROLE_TEST_LOGIN } from '../staging/stagingMode';
import { useNotifications } from '../shared/notifications/NotificationsProvider';
const NotificationDrawer = lazy(() => import('../features/administration/NotificationsPage').then((module) => ({ default: module.NotificationDrawer })));

export interface AppShellProps extends HeaderProps {
  children: ReactNode;
  /**
   * Opt the page content into the shared v2 token scope after the owner has reviewed that screen
   * (docs/DESIGN-SYSTEM-V2-FOUNDATION.md). The shell chrome (Sidebar, Header) always uses v2.
   */
  designSystem?: 'v2';
}

/**
 * Shared app shell used by every authenticated screen (Page 04 frames, e.g. SCR-ADMIN-001 288:3192):
 * Sidebar 240 | Main = Header 64 + Content. Below 1024px the sidebar becomes a navigation drawer (Design System v2 §E).
 * The role comes from `GET /api/auth/me` (wired by CORE-008/009); this component never decides access.
 */
export function AppShell({ children, designSystem, ...headerProps }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const notifications = useNotifications();
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const [openedAt, setOpenedAt] = useState(pathname);
  // Following any navigation closes the drawer (render-time reset avoids an effect cascade).
  if (navOpen && openedAt !== pathname) setNavOpen(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNavOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const toggle = () => { setOpenedAt(pathname); setNavOpen((open) => !open); };
  const close = () => { setNavOpen(false); menuButton.current?.focus(); };

  return (
    <div className={styles.shell} data-app-shell>
      <a className={styles.skip} href="#main-content">Skip to main content</a>
      <Sidebar role={headerProps.user.role} id="app-navigation" open={navOpen} />
      {navOpen && <button type="button" className={styles.scrim} aria-label="Close navigation" tabIndex={-1} onClick={close} />}
      <div className={styles.main}>
        <Header {...headerProps} unreadCount={notifications ? notifications.unreadCount : headerProps.unreadCount}
          unreadStatus={notifications?.error ? 'unavailable' : notifications?.pending ? 'loading' : undefined}
          onNotificationsClick={headerProps.onNotificationsClick ?? (() => setNoticesOpen(true))} menuButtonRef={menuButton} navigationId="app-navigation" navigationOpen={navOpen} onMenuClick={toggle} />
        {noticesOpen && <Suspense fallback={<p role="status">Loading notifications…</p>}><NotificationDrawer onClose={() => setNoticesOpen(false)} /></Suspense>}
        <main id="main-content" tabIndex={-1} className={styles.content} data-design-system={designSystem}>
          {ROLE_TEST_LOGIN && <AlertBanner type="warning" title="Protected test sign-in — UI inspection only">Server operations are unavailable for test roles. Nothing is created, changed or saved.</AlertBanner>}
          {businessDataMode() === 'sample' && <AlertBanner type="info" title="Sample business data (test fixtures)">Records come from the test-only sample store.</AlertBanner>}
          {children}
        </main>
      </div>
    </div>
  );
}
