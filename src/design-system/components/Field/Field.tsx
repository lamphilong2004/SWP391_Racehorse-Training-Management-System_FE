import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Field.module.css';

export interface FieldProps {
  id: string;
  label: string;
  helperText?: string;
  /** Field-level error message. Never use a modal for field errors (Figma Input 7:22). */
  error?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + helper/error row shared by TextField and SelectField (Figma Input 7:22 / Select 7:47). */
export function Field({ id, label, helperText, error, disabled, className, children }: FieldProps) {
  const message = error ?? helperText;
  return (
    <div className={cx(styles.field, disabled && styles.disabled, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {message && (
        <p id={`${id}-message`} className={cx(styles.message, error && styles.errorMessage)}>
          {message}
        </p>
      )}
    </div>
  );
}
