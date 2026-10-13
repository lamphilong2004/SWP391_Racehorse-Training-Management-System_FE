import { useId, type TextareaHTMLAttributes } from 'react';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';
import { cx } from '../../utils/cx';
export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; helperText?: string; error?: string }
export function TextAreaField({ label, helperText, error, id, className, disabled, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return <Field id={inputId} label={label} helperText={helperText} error={error} disabled={disabled} className={className}>
    <textarea id={inputId} rows={4} className={cx(fieldControlClasses.control, error && fieldControlClasses.error)}
      disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={error || helperText ? inputId + '-message' : undefined} {...rest} />
  </Field>;
}
