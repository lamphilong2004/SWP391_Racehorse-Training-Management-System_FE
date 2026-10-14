import { useId, type InputHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  helperText?: string;
  error?: string;
}

/** Figma Input (7:22). Placeholders describe the format and never repeat the label. */
export function TextField({ label, helperText, error, id, className, disabled, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasMessage = Boolean(error ?? helperText);
  return (
    <Field id={inputId} label={label} helperText={helperText} error={error} disabled={disabled} className={className}>
      <input
        id={inputId}
        className={cx(fieldControlClasses.control, error && fieldControlClasses.error)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? `${inputId}-message` : undefined}
        {...rest}
      />
    </Field>
  );
}
