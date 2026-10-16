import { useId, type ChangeEventHandler } from 'react';

interface MedicalTextAreaProps {
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

/** Native clinical text input kept inside the medical feature until the shared field is owned by CORE-002. */
export function MedicalTextArea({ label, value, onChange, disabled, required, error }: MedicalTextAreaProps) {
  const id = useId();
  const errorId = useId();
  return <div className="medical-textarea-field">
    <label htmlFor={id}>{label}</label>
    <textarea id={id} value={value} onChange={onChange} disabled={disabled} required={required}
      aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
    {error && <span id={errorId} role="alert">{error}</span>}
  </div>;
}
