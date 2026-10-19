import { cx } from '../../utils/cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

/**
 * Empty state as drawn in the approved screens (SCR-OWNER-002 Race History 329:6273,
 * SCR-COST-003 337:6826): dashed subtle box, centred title + description. Copy is per screen.
 */
export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
