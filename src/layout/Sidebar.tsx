import { NavLink } from 'react-router';
import { Icon } from '../design-system/icons/Icon';
import { cx } from '../design-system/utils/cx';
import type { RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from './navigation';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  role: RoleCode;
}

/** Figma Sidebar (74:110): 240px, brand, workspace label, role-filtered sections. */
export function Sidebar({ role }: SidebarProps) {
  const nav = NAVIGATION[role];
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Icon name="horseshoe" size={24} className={styles.brandIcon} />
        <span className={styles.brandName}>Racehorse Ops</span>
      </div>
      <p className={styles.workspace}>{nav.workspaceLabel}</p>
      <div className={styles.spacer} />
      <nav aria-label="Main" className={styles.nav}>
        {nav.sections.map((section, sectionIndex) => (
          <div key={section.heading ?? sectionIndex} className={styles.section}>
            {section.heading && <p className={styles.heading}>{section.heading}</p>}
            {section.items.map((item) => (
              <NavLink
                key={`${item.label}-${item.to}`}
                to={item.to}
                end
                className={({ isActive }) => cx(styles.item, isActive && styles.active)}
              >
                <Icon name={item.icon} size={20} className={styles.itemIcon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
