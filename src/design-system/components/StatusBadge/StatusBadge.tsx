import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import { STATUS_REGISTRY, type BadgeSpec, type StatusFamily, type StatusOf } from './statusRegistry';
import styles from './StatusBadge.module.css';

export interface StatusBadgeProps<F extends StatusFamily> {
  family: F;
  status: StatusOf<F>;
  className?: string;
}

/**
 * Status pill: colour + icon + text, never colour alone (Foundations · Status system 5:2).
 * Height 24, padding 0 8, gap 4, 14px icon, Overline label.
 */
export function StatusBadge<F extends StatusFamily>({ family, status, className }: StatusBadgeProps<F>) {
  const spec = (STATUS_REGISTRY[family] as Record<PropertyKey, BadgeSpec>)[status];
  return (
    <span className={cx(styles.badge, styles[spec.tone], className)} data-status={String(status)}>
      <Icon name={spec.icon} size={14} />
      <span className={styles.label}>{spec.label}</span>
    </span>
  );
}
