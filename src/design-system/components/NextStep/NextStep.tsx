import type { ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { ButtonLink } from '../Button/ButtonLink';
import styles from './NextStep.module.css';

export interface NextStepAction { label: string; to: string }

export interface NextStepProps {
  /** What happens next, phrased as the next action ("Lên lịch buổi tập đầu tiên"). */
  title: string;
  /** Who is responsible: a role or a person ("Trainer · Hà Linh"). */
  owner: string;
  children?: ReactNode;
  /** Direct action, only when the current user is allowed to take it. */
  action?: NextStepAction;
  secondary?: NextStepAction;
}

/** Hand-off panel shown after a task: the next action, its owner and, when permitted, a direct link. */
export function NextStep(props: NextStepProps) {
  // Leader request 11/11: hand-off panels are not shown; the toast already confirms the action.
  void props; return null;
}
export function NextStepPanel({ title, owner, children, action, secondary }: NextStepProps) {
  return <section className={styles.step} aria-label={`Bước tiếp theo: ${title}`}>
    <Icon name="chevron-right" size={20} className={styles.icon} />
    <div className={styles.text}>
      <p className={styles.eyebrow}>Bước tiếp theo</p>
      <p className={styles.title}>{title}</p>
      <p className={styles.owner}><Icon name="user" size={14} />Người phụ trách: {owner}</p>
      {children && <div className={styles.body}>{children}</div>}
      {(action || secondary) && <div className={styles.actions}>
        {action && <ButtonLink variant="primary" to={action.to}>{action.label}</ButtonLink>}
        {secondary && <ButtonLink variant="secondary" to={secondary.to}>{secondary.label}</ButtonLink>}
      </div>}
    </div>
  </section>;
}
