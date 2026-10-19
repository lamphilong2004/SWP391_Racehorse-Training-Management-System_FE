import { useId, useState } from 'react';
import { cx } from '../../utils/cx';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';
import styles from './RadioGroup.module.css';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  label: string;
  options: ReadonlyArray<RadioOption>;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/** Choice cards mapped to the Assessment options in Figma 165:7921. */
export function RadioGroup({
  label,
  options,
  name,
  value,
  defaultValue,
  onChange,
  helperText,
  error,
  disabled,
  required,
  id,
  className,
}: RadioGroupProps) {
  const autoId = useId();
  const groupId = id ?? autoId;
  const radioName = name ?? groupId;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const hasMessage = Boolean(error ?? helperText);

  const selectValue = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
  };

  return (
    <Field
      id={groupId}
      label={label}
      labelAsLegend
      helperText={helperText}
      error={error}
      disabled={disabled}
      required={required}
      className={className}
    >
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={hasMessage ? `${groupId}-message` : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        className={styles.options}
      >
        {options.map((option, index) => {
          const optionId = `${groupId}-${index}`;
          const selected = selectedValue === option.value;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cx(
                styles.option,
                selected && styles.selected,
                error && fieldControlClasses.error,
                disabled && styles.optionDisabled,
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={radioName}
                value={option.value}
                checked={selected}
                required={required}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={hasMessage ? `${groupId}-message` : undefined}
                className="visually-hidden"
                onChange={() => selectValue(option.value)}
              />
              <span className={styles.indicator} aria-hidden="true" />
              <span className={styles.optionLabel}>{option.label}</span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}
