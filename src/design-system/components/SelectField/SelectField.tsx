import { useId, type SelectHTMLAttributes } from 'react';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';
import styles from './SelectField.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  /** Shown as the first, empty option (for example "Select role"). */
  placeholder?: string;
  helperText?: string;
  error?: string;
}

/** Figma Select (7:47): same metrics as Input plus a trailing chevron-down (20px). */
export function SelectField({
  label,
  options,
  placeholder,
  helperText,
  error,
  id,
  className,
  disabled,
  value,
  defaultValue,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hasMessage = Boolean(error ?? helperText);
  const isEmpty = (value ?? defaultValue ?? '') === '';
  return (
    <Field id={selectId} label={label} helperText={helperText} error={error} disabled={disabled} className={className}>
      <div className={cx(fieldControlClasses.control, error && fieldControlClasses.error, styles.wrapper)}>
        <select
          id={selectId}
          className={cx(styles.select, isEmpty && placeholder && styles.placeholder)}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? `${selectId}-message` : undefined}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </div>
    </Field>
  );
}
