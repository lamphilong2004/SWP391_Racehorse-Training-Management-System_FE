import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { initials } from '../../utils/initials';
import styles from './CandidateCard.module.css';

export interface CandidateFact {
  label: string;
  value: ReactNode;
}

export interface CandidateCardProps {
  name: string;
  /** Role · experience, e.g. "Trainer · 6 yrs experience". */
  subtitle: string;
  /** Specialisation / skill labels. */
  tags?: string[];
  /** Plain label/value reasons. No scores (CORE-002 DoD). */
  facts?: CandidateFact[];
  /** Footer actions: "View profile" (tertiary) left, "Select" (primary) right. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Figma Candidate Card (75:418), shared by Trainer recommendation (SCR-TRAIN-022) and Work Rider recommendation
 * (SCR-TRAIN-023). Recommendations warn, they never block.
 */
export function CandidateCard({ name, subtitle, tags = [], facts = [], actions, className }: CandidateCardProps) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(name)}
        </span>
        <div className={styles.name}>
          <h3 className={styles.fullName}>{name}</h3>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      {tags.length > 0 && (
        <ul className={styles.tags} aria-label="Kỹ năng">
          {tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}
      {facts.length > 0 && (
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
