import type { ReactNode } from 'react';
import type { IconName } from '../../icons/Icon';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './ValidationNotice.module.css';

/**
 * Exercise / assignment suitability categories (Figma Validation Notice 70:138, ui-state-specification §11):
 * a = medical hard block (cannot override), b = operational hard block, c = warning, d = recommendation mismatch.
 */
export type ValidationCategory = 'a' | 'b' | 'c' | 'd';

const CATEGORY: Record<ValidationCategory, { label: string; icon: IconName }> = {
  a: { label: 'Loại A · Chặn bắt buộc do y tế', icon: 'shield-alert' },
  b: { label: 'Loại B · Chặn bắt buộc do vận hành', icon: 'calendar-x' },
  c: { label: 'Loại C · Cảnh báo / thận trọng', icon: 'alert-triangle' },
  d: { label: 'Loại D · Không khuyến nghị', icon: 'target' },
};

export interface ValidationNoticeProps {
  category: ValidationCategory;
  title: string;
  /** Explanation paragraph. */
  children?: ReactNode;
  /** Caption line (source of the rule, e.g. "Restriction set by Dr. Le · 2026-09-14"). */
  meta?: string;
  /** Category A only: note next to the CANNOT OVERRIDE pill. */
  lockNote?: string;
  /** Buttons / acknowledgement fields. Laid out in a row for A/B and in a column for C/D. */
  actions?: ReactNode;
  className?: string;
}

/** Never colour-only: icon + category label + title + explanation + action treatment. */
export function ValidationNotice({ category, title, children, meta, lockNote, actions, className }: ValidationNoticeProps) {
  const spec = CATEGORY[category];
  const isBlock = category === 'a' || category === 'b';
  const showActionRow = category === 'a' || Boolean(actions);
  return (
    <div className={cx(styles.notice, styles[category], className)} role={isBlock ? 'alert' : 'status'}>
      <div className={styles.header}>
        <Icon name={spec.icon} size={24} className={styles.icon} />
        <div className={styles.heading}>
          <span className={styles.category}>{spec.label}</span>
          <p className={styles.title}>{title}</p>
        </div>
      </div>
      {children && <div className={styles.body}>{children}</div>}
      {meta && <p className={styles.meta}>{meta}</p>}
      {showActionRow && (
        <div className={cx(styles.actions, isBlock ? styles.actionsRow : styles.actionsColumn)}>
          {category === 'a' && (
            <>
              <span className={styles.lockPill}>
                <Icon name="lock" size={14} />
                <span>Không thể bỏ qua</span>
              </span>
              {lockNote && <span className={styles.meta}>{lockNote}</span>}
            </>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
