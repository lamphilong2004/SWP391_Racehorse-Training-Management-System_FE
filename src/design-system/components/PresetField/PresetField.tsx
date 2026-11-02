import { useState } from 'react';
import { SelectField, type SelectOption } from '../SelectField/SelectField';
import { TextField } from '../TextField/TextField';
import styles from './PresetField.module.css';

interface PresetFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: string;
}

/** Suggestions for an existing free-text contract, never a new validation catalogue. */
export function PresetField({ label, value, onValueChange, options, maxLength, required, disabled, helperText, error }: PresetFieldProps) {
  const [manual, setManual] = useState(false);
  const custom = manual || Boolean(value && !options.some(option => option.value === value));
  return <div className={styles.stack}>
    <SelectField label={label} required={required} disabled={disabled} placeholder="Chọn giá trị"
      value={custom ? '__CUSTOM_VALUE__' : value}
      options={[...options, { value: '__CUSTOM_VALUE__', label: 'Khác — nhập thêm' }]}
      helperText={helperText} error={custom ? undefined : error}
      onChange={event => {
        const next = event.target.value;
        setManual(next === '__CUSTOM_VALUE__');
        // Keep existing content when switching to manual entry; never silently erase a saved value.
        if (next !== '__CUSTOM_VALUE__') onValueChange(next);
      }} />
    {custom && <TextField label={`${label} (nhập thêm)`} value={value} maxLength={maxLength}
      required={required} disabled={disabled} error={error} autoComplete="off"
      onChange={event => onValueChange(event.target.value)} />}
  </div>;
}
