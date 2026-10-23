import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './WizardStepper.module.css';

export interface WizardStepperProps {
  steps: string[];
  /** Zero-based index of the current step. Steps before it are done, steps after it are to-do. */
  currentStep: number;
  /** Completed steps are clickable; there is no skipping ahead (Figma Wizard Stepper 73:63). */
  onStepClick?: (index: number) => void;
  label?: string;
  className?: string;
}

export function WizardStepper({ steps, currentStep, onStepClick, label = 'Tiến độ', className }: WizardStepperProps) {
  return (
    <ol aria-label={label} className={cx(styles.stepper, className)}>
      {steps.map((step, index) => {
        const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
        const content = (
          <>
            <span className={cx(styles.marker, styles[`marker-${state}`])}>
              {state === 'done' ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span className={cx(styles.label, styles[`label-${state}`])}>{step}</span>
          </>
        );
        return (
          <li key={step} className={styles.item} aria-current={state === 'current' ? 'step' : undefined}>
            {index > 0 && (
              <span aria-hidden="true" className={cx(styles.connector, index <= currentStep && styles.connectorDone)} />
            )}
            {state === 'done' && onStepClick ? (
              <button type="button" className={styles.step} onClick={() => onStepClick(index)}>
                {content}
              </button>
            ) : (
              <span className={styles.step}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
