import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Card.module.css';

export interface CardProps {
  title?: string;
  /** Right side of the header, for example a "View all" link. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Figma Card (71:51): surface, radius/md, elev/1, padding 24; header + divider when a title is given. */
export function Card({ title, action, children, className }: CardProps) {
  const hasHeader = Boolean(title || action);
  return (
    <section className={cx(styles.card, className)}>
      {hasHeader && (
        <>
          <header className={styles.header}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {action && <div className={styles.action}>{action}</div>}
          </header>
          <div className={styles.divider} role="presentation" />
        </>
      )}
      {children}
    </section>
  );
}
