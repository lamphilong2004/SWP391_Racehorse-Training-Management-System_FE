import { Breadcrumb, type BreadcrumbItem } from '../design-system/components/Breadcrumb/Breadcrumb';
import { Icon } from '../design-system/icons/Icon';
import { initials } from '../design-system/utils/initials';
import { ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import styles from './Header.module.css';
import { useNavigate } from 'react-router';
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
}: HeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <div className={styles.left}>
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
          <input name="q" type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        </form>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.bell}
          onClick={onNotificationsClick}
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
