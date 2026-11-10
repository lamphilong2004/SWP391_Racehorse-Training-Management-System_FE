import { useEffect, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import { Field } from '../Field/Field';
import { fieldControlClasses } from '../Field/fieldControl';
import { Icon } from '../../icons/Icon';
import { formatVn, parseVn, placeholderVn, type VnDateKind } from './vnDate';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  helperText?: string;
  error?: string;
}

const VN_KINDS = new Set(['date', 'datetime-local', 'time']);

/** Figma Input (7:22). Placeholders describe the format and never repeat the label. */
export function TextField(props: TextFieldProps) {
  if (props.type && VN_KINDS.has(props.type)) return <VnDateTimeField {...props} />;
  return <PlainTextField {...props} />;
}

function PlainTextField({ label, helperText, error, id, className, disabled, required, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasMessage = Boolean(error ?? helperText);
  return (
    <Field id={inputId} label={label} helperText={helperText} error={error} disabled={disabled} required={required} className={className}>
      <input
        id={inputId}
        className={cx(fieldControlClasses.control, error && fieldControlClasses.error)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? `${inputId}-message` : undefined}
        {...rest}
        aria-label={rest['aria-label'] ?? label}
      />
    </Field>
  );
}

/**
 * Date / datetime-local / time shown and typed the Vietnamese way (dd/mm/yyyy, 24h HH:mm) whatever the browser
 * language. The visible field is text; the calendar button opens the browser picker on a hidden native input.
 * onChange still receives the ISO value ("2026-11-11", "2026-11-11T09:30", "09:30"), or "" while incomplete.
 */
function VnDateTimeField({ label, helperText, error, id, className, disabled, required, readOnly, type, value, defaultValue, onChange, min, max, step, placeholder, ...rest }: TextFieldProps) {
  const kind = type as VnDateKind;
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasMessage = Boolean(error ?? helperText);
  const controlled = value !== undefined;
  const isoValue = String((controlled ? value : defaultValue) ?? '');
  const [draft, setDraft] = useState(() => formatVn(kind, isoValue));
  const lastEmitted = useRef(isoValue);
  const native = useRef<HTMLInputElement>(null);

  // Follow value changes made by the parent (reset, load), but not our own emissions while the user is typing.
  useEffect(() => {
    if (controlled && isoValue !== lastEmitted.current) { lastEmitted.current = isoValue; setDraft(formatVn(kind, isoValue)); }
  }, [controlled, isoValue, kind]);

  const emit = (iso: string, source: HTMLInputElement) => {
    lastEmitted.current = iso;
    if (!onChange) return;
    // Plain object: consumers read target.value (ISO); the visible input keeps the Vietnamese text.
    const target = { value: iso, name: rest.name ?? source.name, id: inputId, type: kind, form: source.form };
    onChange({ target, currentTarget: target, type: 'change', nativeEvent: new Event('change'), preventDefault() {}, stopPropagation() {}, persist() {} } as unknown as ChangeEvent<HTMLInputElement>);
  };
  const onText = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    const iso = parseVn(kind, text);
    // Typing an ISO value (paste, tests) is shown back in Vietnamese format.
    setDraft(iso && /^\d{4}-|^\d{2}:\d{2}$/.test(text.trim()) ? formatVn(kind, iso) : text);
    emit(iso ?? '', event.target);
  };
  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const iso = parseVn(kind, event.target.value) ?? '';
    setDraft(formatVn(kind, iso)); emit(iso, event.target);
  };
  const invalid = Boolean(error) || (draft.trim() !== '' && parseVn(kind, draft) === null);

  return (
    <Field id={inputId} label={label} helperText={helperText ?? (invalid && !error ? `Nhập theo dạng ${placeholderVn(kind)}` : undefined)} error={error} disabled={disabled} required={required} className={className}>
      <div className={styles.dateWrap}>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={cx(fieldControlClasses.control, invalid && fieldControlClasses.error, styles.dateInput)}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          placeholder={placeholder ?? placeholderVn(kind)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={hasMessage || invalid ? `${inputId}-message` : undefined}
          {...rest}
          value={draft}
          onChange={onText}
          aria-label={rest['aria-label'] ?? label}
        />
        {!readOnly && <button type="button" className={styles.pickerButton} disabled={disabled} tabIndex={-1} aria-hidden="true"
          onClick={() => { try { native.current?.showPicker?.(); } catch { native.current?.focus(); } }}>
          <Icon name={kind === 'time' ? 'clock' : 'calendar'} size={16} />
        </button>}
        <input ref={native} type={kind} tabIndex={-1} aria-hidden="true" className={styles.nativePicker}
          value={parseVn(kind, draft) || ''} min={min} max={max} step={step} disabled={disabled || readOnly} onChange={onPick} />
      </div>
    </Field>
  );
}
