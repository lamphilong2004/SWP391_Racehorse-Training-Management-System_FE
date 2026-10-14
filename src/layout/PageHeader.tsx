import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned buttons; at most one primary action per screen. */
  actions?: ReactNode;
}

/** Title row at the top of the content area (e.g. SCR-ADMIN-001 TitleRow 288:3298): H1 + secondary line + actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className={styles.row}>
      <div className={styles.title}>
        <h1 className={styles.heading}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
