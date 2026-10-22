import type { IconName } from '../../icons/Icon';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './MetricCard.module.css';

export type RealtimeState = 'normal' | 'warning' | 'critical';
export type CaptionTone = 'success' | 'warning' | 'danger' | 'secondary';

const REALTIME_ICONS: Record<RealtimeState, IconName> = {
  normal: 'activity',
  warning: 'alert-triangle',
  critical: 'alert-octagon',
};

/** Placeholder texts used across screens when the API has no value. */
const UNAVAILABLE_VALUE = /^(not (provided|measured|recorded|supplied|available)|unavailable|—)$/i;

const REALTIME_TONE: Record<RealtimeState, CaptionTone> = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
};

export interface MetricCardProps {
  label: string;
  value: string;
  /** Sub row text (for example "+2 vs yesterday" or "Normal — threshold 180 bpm"). Never colour alone. */
  caption?: string;
  /** Default variant only: optional icon and tone for the caption. */
  captionIcon?: IconName;
  captionTone?: CaptionTone;
  /** Realtime variant (Figma Metric Card 71:60): status dot + 4px accent bar + Metric L value. */
  realtimeState?: RealtimeState;
  /** The API supplies no value: show it as quiet text instead of a headline number. Defaults to
   *  true for the standard placeholder texts ('Not provided', 'Not measured', ...). */
  unavailable?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  caption,
  captionIcon,
  captionTone = 'secondary',
  realtimeState,
  unavailable,
  className,
}: MetricCardProps) {
  const isRealtime = realtimeState !== undefined;
  const tone = isRealtime ? REALTIME_TONE[realtimeState] : captionTone;
  const icon = isRealtime ? REALTIME_ICONS[realtimeState] : captionIcon;
  return (
    <div
      className={cx(styles.card, isRealtime ? cx(styles.realtime, styles[realtimeState]) : styles.default, className)}
      data-state={realtimeState}
    >
      <div className={styles.labelRow}>
        {isRealtime && <span className={styles.dot} aria-hidden="true" />}
        <span className={styles.label}>{label}</span>
      </div>
      <p className={cx(styles.value, (unavailable ?? UNAVAILABLE_VALUE.test(value.trim())) && styles.unavailable)}>{value}</p>
      {caption && (
        <div className={cx(styles.caption, styles[`tone-${tone}`])}>
          {icon && <Icon name={icon} size={14} />}
          <span>{caption}</span>
        </div>
      )}
    </div>
  );
}
