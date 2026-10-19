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
  required?: boolean;
  /** Render the label as a legend inside a fieldset for grouped controls. */
  labelAsLegend?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + helper/error row shared by field-based controls (Figma Input 7:22 / Select 7:47). */
export function Field({
  id,
  label,
  helperText,
  error,
  disabled,
  required,
  labelAsLegend,
  className,
  children,
}: FieldProps) {
  const message = error ?? helperText;
  const labelContent = (
    <>
      {label}
      {required && (
        <span className={styles.requiredMark} aria-hidden="true">
          {' *'}
        </span>
      )}
    </>
  );
  const labelElement = labelAsLegend ? (
    <legend id={`${id}-label`} className={styles.label}>
      {labelContent}
    </legend>
  ) : (
    <label id={`${id}-label`} className={styles.label} htmlFor={id}>
      {labelContent}
    </label>
  );
  const messageElement = message ? (
    <p id={`${id}-message`} className={cx(styles.message, error && styles.errorMessage)}>
      {message}
    </p>
  ) : null;
  const fieldClassName = cx(styles.field, disabled && styles.disabled, className);

  if (labelAsLegend) {
    return (
      <fieldset id={id} className={cx(fieldClassName, styles.fieldset)} disabled={disabled}>
        {labelElement}
        {children}
        {messageElement}
      </fieldset>
    );
  }

  return (
    <div className={fieldClassName}>
      {labelElement}
      {children}
      {messageElement}
    </div>
  );
}
