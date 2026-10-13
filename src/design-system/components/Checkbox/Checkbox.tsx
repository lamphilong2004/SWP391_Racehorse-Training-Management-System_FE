import { useId, type InputHTMLAttributes } from 'react';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: string;
}

/**
 * Checkbox as drawn in the Full Product screens (SCR-RACE-002 327:6160 checked / 327:6184 empty / 327:6304 disabled;
 * same look as LP-02 "Remember me" 409:62): 18px, radius/sm, 1.5px border, white 14px check on primary.
 */
export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cx(styles.checkbox, className)}>
      <input id={inputId} type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={14} className={styles.check} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
