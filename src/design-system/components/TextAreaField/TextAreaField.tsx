import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label: string;
  helperText?: string;
  error?: string;
}

/** Multiline field mapped to the Professional notes control in Figma 165:7932. */
export function TextAreaField({
  label,
  helperText,
  error,
  id,
  className,
  disabled,
  required,
  rows,
  ...rest
}: TextAreaFieldProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const hasMessage = Boolean(error ?? helperText);

  return (
    <Field
      id={textareaId}
      label={label}
      helperText={helperText}
      error={error}
      disabled={disabled}
      required={required}
      className={className}
    >
      <textarea
        id={textareaId}
        rows={rows ?? 3}
        className={cx(fieldControlClasses.control, fieldControlClasses.multiline, error && fieldControlClasses.error)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? `${textareaId}-message` : undefined}
        {...rest}
      />
    </Field>
  );
}
