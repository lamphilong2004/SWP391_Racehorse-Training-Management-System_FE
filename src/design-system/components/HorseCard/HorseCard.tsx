import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { HorseAvatar } from '../HorseAvatar/HorseAvatar';
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
  /** Horse photo URL; without one the default horse artwork fills the photo area. */
  photoSrc?: string | null;
  /** Footer action, typically a tertiary "View profile" Button. */
  action?: ReactNode;
  className?: string;
}

/**
 * Figma Horse Card (75:360): 280 wide; newest horse photo or the default horse artwork;
 * Training Availability always shown as icon + text.
 */
export function HorseCard({ name, meta, availability, facts = [], photoSrc, action, className }: HorseCardProps) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.photo}>
        <HorseAvatar size="xl" src={photoSrc} name={name} labelDefault />
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
