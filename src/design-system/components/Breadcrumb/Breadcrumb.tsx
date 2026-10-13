import { Fragment } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page (last item). */
  to?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Figma Breadcrumb (71:123): Caption, chevron-right 14px, current item in text/primary. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cx(styles.breadcrumb, className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {item.to && !isLast ? (
              <Link to={item.to} className={styles.item}>
                {item.label}
              </Link>
            ) : (
              <span className={cx(styles.item, isLast && styles.current)} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && <Icon name="chevron-right" size={14} className={styles.separator} />}
          </Fragment>
        );
      })}
    </nav>
  );
}
