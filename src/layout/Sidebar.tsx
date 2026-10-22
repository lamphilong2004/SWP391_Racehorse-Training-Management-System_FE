import { Link, NavLink } from 'react-router';
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

/** First visible navigation entry for a destination (entries are shared objects from NAVIGATION). */
function firstItemFor(role: RoleCode, to: string) {
  return visibleSections(role).flatMap((section) => section.items).find((item) => item.to === to);
}

/** Figma Sidebar (74:110): 240px navy (Design System v2), brand, workspace label, role-filtered sections. */
export function Sidebar({ role, id, open = false }: SidebarProps) {
  const nav = NAVIGATION[role];
  return (
    <aside id={id} className={cx(styles.sidebar, open && styles.open)} data-design-system="v2" aria-label="Workspace navigation">
      <div className={styles.brand}>
        <Icon name="horseshoe" size={24} className={styles.brandIcon} />
        <span className={styles.brandName}>Racehorse Ops</span>
      </div>
      <p className={styles.workspace}>{nav.workspaceLabel}</p>
      <div className={styles.spacer} />
      <nav aria-label="Main" className={styles.nav}>
        {visibleSections(role).map((section, sectionIndex) => (
          <div key={section.heading ?? sectionIndex} className={styles.section}>
            {section.heading && <p className={styles.heading}>{section.heading}</p>}
            {section.items.map((item) => {
              // Several entries can share one destination (Work Rider 'Report Issue' opens Assignments);
              // only the first is marked current so one item is highlighted.
              const duplicate = firstItemFor(role, item.to) !== item;
              return duplicate
                ? <Link key={`${item.label}-${item.to}`} to={item.to} className={styles.item}>
                    <Icon name={item.icon} size={20} className={styles.itemIcon} />
                    <span>{item.label}</span>
                  </Link>
                : <NavLink
                    key={`${item.label}-${item.to}`}
                    to={item.to}
                    end
                    className={({ isActive }) => cx(styles.item, isActive && styles.active)}
                  >
                    <Icon name={item.icon} size={20} className={styles.itemIcon} />
                    <span>{item.label}</span>
                  </NavLink>;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
