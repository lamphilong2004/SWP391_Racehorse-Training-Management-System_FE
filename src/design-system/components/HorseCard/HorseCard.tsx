import type { ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import { KeyValue } from '../KeyValue/KeyValue';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import type { StatusOf } from '../StatusBadge/statusRegistry';
import styles from './HorseCard.module.css';

export interface HorseCardFact {
  label: string;
  value: ReactNode;
}

export interface HorseCardProps {
  name: string;
  /** Code · breed · age · box, e.g. "TB-001 · Thoroughbred · 4 yrs · Box A-12". */
  meta: string;
  availability: StatusOf<'availability'>;
  /** Key-value facts under the divider (Weight, Next session, …). */
  facts?: HorseCardFact[];
  /** Footer action, typically a tertiary "View profile" Button. */
  action?: ReactNode;
  className?: string;
}

/**
 * Figma Horse Card (75:360): 280 wide; neutral photo placeholder until a photo source is approved;
 * Training Availability always shown as icon + text.
 */
export function HorseCard({ name, meta, availability, facts = [], action, className }: HorseCardProps) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.photo}>
        <Icon name="horseshoe" size={40} />
        <span className={styles.noPhoto}>Chưa có ảnh</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.meta}>{meta}</p>
        <StatusBadge family="availability" status={availability} />
        {facts.length > 0 && (
          <>
            <div className={styles.divider} role="presentation" />
            <div className={styles.facts}>
              {facts.map((fact) => (
                <KeyValue key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </>
        )}
        {action}
      </div>
    </article>
  );
}
