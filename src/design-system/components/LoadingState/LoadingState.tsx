import { cx } from '../../utils/cx';
import styles from './LoadingState.module.css';

export interface LoadingStateProps {
  /** Short status text, e.g. "Loading horses…". */
  label?: string;
  className?: string;
}

/**
 * Loading state for data regions. There is no dedicated Figma frame for loading; this reuses the approved
 * EmptyState container (329:6273) with a token-coloured progress ring so all three data states share one shape.
 */
export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div className={cx(styles.loading, className)} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.ring} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  );
}
