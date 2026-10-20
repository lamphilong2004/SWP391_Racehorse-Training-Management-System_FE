import { cx } from '../../utils/cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps { label?: string; lines?: number; shape?: 'text' | 'card' | 'circle'; className?: string }
/** Controlled loading region. Callers replace it with real content, empty state or an error. */
export function Skeleton({ label = 'Loading…', lines = 3, shape = 'text', className }: SkeletonProps) {
  const count = Number.isFinite(lines) ? Math.min(12, Math.max(1, Math.trunc(lines))) : 3;
  return <div role="status" aria-label={label} aria-busy="true" className={cx(styles.root, className)}>
    {Array.from({ length: shape === 'text' ? count : 1 }, (_, i) => <span key={i} aria-hidden="true" className={cx(styles.placeholder, styles[shape])} />)}
  </div>;
}
