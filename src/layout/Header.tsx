import { Breadcrumb, type BreadcrumbItem } from '../design-system/components/Breadcrumb/Breadcrumb';
import { Icon } from '../design-system/icons/Icon';
import { initials } from '../design-system/utils/initials';
import { ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import styles from './Header.module.css';
import { useLocation, useNavigate } from 'react-router';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { ROUTES } from '../app/routePaths';
import { useAuth } from '../shared/auth/AuthProvider';

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
  unreadStatus?: 'loading' | 'unavailable';
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
  searchPlaceholder = 'Tìm kiếm…',
  onSearch,
  unreadCount = 0,
  unreadStatus,
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
            aria-label={navigationOpen ? 'Đóng menu' : 'Mở menu'} aria-controls={navigationId} aria-expanded={navigationOpen}>
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
            disabled={!onSearch} title={onSearch ? undefined : 'Màn hình này không hỗ trợ tìm kiếm chung. Hãy dùng bộ lọc của trang.'} />
        </form>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.bell}
          onClick={onNotificationsClick ?? (() => navigate(ROUTES.notifications))}
          aria-label={unreadStatus === 'unavailable' ? 'Thông báo, không lấy được số chưa đọc' : unreadStatus === 'loading' ? 'Thông báo, đang kiểm tra số chưa đọc' : unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
          title={unreadStatus === 'unavailable' ? 'Không lấy được số chưa đọc. Mở thông báo để thử lại.' : undefined}
        >
          <Icon name="bell" size={22} />
          {!unreadStatus && unreadCount > 0 && <span className={styles.count}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        <UserMenu user={user} unreadCount={unreadStatus ? undefined : unreadCount}
          onNotificationsClick={onNotificationsClick ?? (() => navigate(ROUTES.notifications))} onUserMenuClick={onUserMenuClick} />
      </div>
    </header>
  );
}

/** The header is also rendered without AuthProvider (isolated layout tests); sign-out is then not offered. */
function useAuthIfAvailable() {
  try { return useAuth(); } catch { return null; }
}

interface UserMenuProps {
  user: HeaderUser;
  unreadCount?: number;
  onNotificationsClick: () => void;
  onUserMenuClick?: () => void;
}

/** Account dropdown: identity card, account shortcuts and sign-out (menu-button pattern, keyboard operable). */
function UserMenu({ user, unreadCount, onNotificationsClick, onUserMenuClick }: UserMenuProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuthIfAvailable();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  // Following any navigation closes the menu (render-time reset, same as the navigation drawer).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const go = (to: string) => { close(false); navigate(to); };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') setOpen(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); items[event.key === 'Home' ? 0 : items.length - 1]?.focus(); }
  };
  const signOut = async () => {
    if (!auth?.logout || busy) return;
    setBusy(true);
    try { await auth.logout(); } finally { setBusy(false); setOpen(false); }
    navigate(ROUTES.login, { replace: true });
  };
  const email = auth?.user?.email;

  return (
    <div className={styles.userMenu} ref={root} onKeyDown={open ? onMenuKey : undefined}>
      <button type="button" ref={trigger} className={styles.user} aria-label="Menu tài khoản"
        aria-haspopup={onUserMenuClick ? undefined : 'menu'} aria-expanded={onUserMenuClick ? undefined : open} aria-controls={open ? menuId : undefined}
        onClick={onUserMenuClick ?? (() => { setOpenedAt(pathname); setOpen((value) => !value); })}>
        <span className={styles.avatar} aria-hidden="true">{initials(user.fullName)}</span>
        <span className={styles.name}>
          <span className={styles.fullName}>{user.fullName}</span>
          <span className={styles.role}>{ROLE_LABELS[user.role]}</span>
        </span>
        <Icon name="chevron-down" size={16} className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
      </button>
      {open && (
        <div className={styles.dropdown} id={menuId} role="menu" aria-label="Tài khoản">
          <div className={styles.identity}>
            <span className={styles.avatarLarge} aria-hidden="true">{initials(user.fullName)}</span>
            <span className={styles.identityText}>
              <strong>{user.fullName}</strong>
              {email && <span className={styles.email} title={email}>{email}</span>}
              <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
            </span>
          </div>
          <div className={styles.menuGroup}>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => go(ROUTES.account)}>
              <span className={styles.menuIcon}><Icon name="user" size={18} /></span>
              <span className={styles.menuText}><span>Tài khoản của tôi</span><small>Hồ sơ cá nhân và thông tin đăng nhập</small></span>
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => go(`${ROUTES.account}#doi-mat-khau`)}>
              <span className={styles.menuIcon}><Icon name="lock" size={18} /></span>
              <span className={styles.menuText}><span>Đổi mật khẩu</span><small>Nên đổi mật khẩu do Club Manager cấp</small></span>
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(false); onNotificationsClick(); }}>
              <span className={styles.menuIcon}><Icon name="bell" size={18} /></span>
              <span className={styles.menuText}><span>Thông báo</span><small>{unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Xem các thông báo gần đây'}</small></span>
              {!!unreadCount && <span className={styles.menuCount}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => go(ROUTES.dashboard)}>
              <span className={styles.menuIcon}><Icon name="dashboard" size={18} /></span>
              <span className={styles.menuText}><span>Không gian làm việc</span><small>Về trang tổng quan của vai trò</small></span>
            </button>
          </div>
          {auth?.logout && (
            <div className={styles.menuGroup}>
              <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.signOut}`} disabled={busy} onClick={() => { void signOut(); }}>
                <span className={styles.menuIcon}><Icon name="log-out" size={18} /></span>
                <span className={styles.menuText}><span>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span></span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
