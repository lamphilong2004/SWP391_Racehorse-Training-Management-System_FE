import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './KeyValue.module.css';

export interface KeyValueProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/** Figma Key-Value Pair (71:102): Caption label (text/secondary) over Body Strong value. */
export function KeyValue({ label, value, className }: KeyValueProps) {
  return (
    <dl className={cx(styles.pair, className)}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </dl>
  );
}
