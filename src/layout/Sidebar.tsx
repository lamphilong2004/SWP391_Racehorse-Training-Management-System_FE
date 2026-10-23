import { Link, useLocation } from 'react-router';
import { Icon } from '../design-system/icons/Icon';
import { cx } from '../design-system/utils/cx';
import type { RoleCode } from '../shared/auth/roles';
import { NAVIGATION, visibleSections } from './navigation';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  role: RoleCode;
  id?: string;
  /** Drawer state below 1024px; the desktop sidebar is always visible. */
  open?: boolean;
}

/**
 * The one entry to highlight: the longest destination that equals the path or prefixes it,
 * so detail routes (/horses/6) keep their list entry current while /horses/pending-activation
 * still selects its own entry. When entries share a destination (Work Rider 'Report Issue'
 * opens Assignments) only the first is highlighted.
 */
function activeItem(role: RoleCode, pathname: string) {
  const items = visibleSections(role).flatMap((section) => section.items);
  const matches = items.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const best = matches.reduce<string | null>((longest, item) => (!longest || item.to.length > longest.length ? item.to : longest), null);
  return best ? items.find((item) => item.to === best) : undefined;
}

/** Figma Sidebar (74:110): 240px navy (Design System v2), brand, workspace label, role-filtered sections. */
export function Sidebar({ role, id, open = false }: SidebarProps) {
  const nav = NAVIGATION[role];
  const active = activeItem(role, useLocation().pathname);
  return (
    <aside id={id} className={cx(styles.sidebar, open && styles.open)} data-design-system="v2" aria-label="Điều hướng không gian làm việc">
      <div className={styles.brand}>
        <Icon name="horseshoe" size={24} className={styles.brandIcon} />
        <span className={styles.brandName}>Racehorse Ops</span>
      </div>
      <p className={styles.workspace}>{nav.workspaceLabel}</p>
      <div className={styles.spacer} />
      <nav aria-label="Chính" className={styles.nav}>
        {visibleSections(role).map((section, sectionIndex) => (
          <div key={section.heading ?? sectionIndex} className={styles.section}>
            {section.heading && <p className={styles.heading}>{section.heading}</p>}
            {section.items.map((item) => {
              const current = item === active;
              return <Link key={`${item.label}-${item.to}`} to={item.to} aria-current={current ? 'page' : undefined} className={cx(styles.item, current && styles.active)}>
                <Icon name={item.icon} size={20} className={styles.itemIcon} />
                <span>{item.label}</span>
              </Link>;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
