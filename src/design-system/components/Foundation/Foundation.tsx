import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Foundation.module.css';

/** A single shared v2 token scope. It does not alter auth, data or any owner feature. */
export function DesignSystemScope({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-design-system="v2" className={cx(styles.scope, className)} />;
}
export function Stack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx(styles.stack, className)} />;
}
/** Three columns desktop, two tablet, one narrow web; children keep their own semantics. */
export function ResponsiveGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx(styles.grid, className)} />;
}

/** Context/back action on the left; secondary then primary actions on the right.
 * Keeps native form and link semantics; never changes submission or permissions.
 */
export function ActionBar({ leading, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { leading?: ReactNode }) {
  return <div {...props} className={cx(styles.actionBar, className)}>
    {leading && <div className={styles.actionContext}>{leading}</div>}
    <div className={styles.actionGroup}>{children}</div>
  </div>;
}
