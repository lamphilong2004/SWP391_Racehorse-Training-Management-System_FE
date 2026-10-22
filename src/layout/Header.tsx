import { Breadcrumb, type BreadcrumbItem } from '../design-system/components/Breadcrumb/Breadcrumb';
import { Icon } from '../design-system/icons/Icon';
import { initials } from '../design-system/utils/initials';
import { ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import styles from './Header.module.css';
import { useNavigate } from 'react-router';
import type { Ref } from 'react';
import { ROUTES } from '../app/routePaths';

export interface HeaderUser {
  fullName: string;
  role: RoleCode;
}

export interface HeaderProps {
  breadcrumb: BreadcrumbItem[];
  user: HeaderUser;
  /** Placeholder of the global search, per screen (for example "Search horses…"). */
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  unreadCount?: number;
  onNotificationsClick?: () => void;
  onUserMenuClick?: () => void;
  /** Supplied by AppShell: opens the navigation drawer below 1024px. */
  onMenuClick?: () => void;
  menuButtonRef?: Ref<HTMLButtonElement>;
  navigationId?: string;
  navigationOpen?: boolean;
}

/** Figma Header (74:367): 64px; breadcrumb, global search, notification bell with count, user + role. */
export function Header({
  breadcrumb,
  user,
  searchPlaceholder = 'Search…',
  onSearch,
  unreadCount = 0,
  onNotificationsClick,
  onUserMenuClick,
  onMenuClick,
  menuButtonRef,
  navigationId,
  navigationOpen = false,
}: HeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={styles.header} data-design-system="v2">
      <div className={styles.left}>
        {onMenuClick && (
          <button type="button" ref={menuButtonRef} className={styles.menu} onClick={onMenuClick}
            aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'} aria-controls={navigationId} aria-expanded={navigationOpen}>
            <Icon name={navigationOpen ? 'x' : 'menu'} size={22} />
          </button>
        )}
        <Breadcrumb items={breadcrumb} />
        <form
          role="search"
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget).get('q');
            onSearch?.(typeof query === 'string' ? query : '');
          }}
        >
          <Icon name="search" size={16} className={styles.searchIcon} />
          <input name="q" type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder}
            disabled={!onSearch} title={onSearch ? undefined : 'Global search is unavailable on this screen. Use its module filters.'} />
        </form>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.bell}
          onClick={onNotificationsClick ?? (() => navigate(ROUTES.notifications))}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Icon name="bell" size={22} />
          {unreadCount > 0 && <span className={styles.count}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        <button type="button" className={styles.user} onClick={onUserMenuClick ?? (() => navigate(ROUTES.account))} aria-label="Account menu">
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className={styles.name}>
            <span className={styles.fullName}>{user.fullName}</span>
            <span className={styles.role}>{ROLE_LABELS[user.role]}</span>
          </span>
          <Icon name="chevron-down" size={16} className={styles.chevron} />
        </button>
      </div>
    </header>
  );
}
