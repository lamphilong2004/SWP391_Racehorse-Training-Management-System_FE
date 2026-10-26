import { useRef, useState } from 'react';
import { AlertBanner, Button, SelectField, TextAreaField, TextField } from '../../design-system';
import { medicalErrorMessage } from './errors';
import { validDate } from './groomService';
import { viLabel } from '../../shared/viLabels';

export interface FormField { name: string; label: string; required?: boolean; type?: string; options?: string[]; maxLength?: number }
export function MedicalForm({ fields, initial = {}, submitLabel, onSave, onCancel }: {
  fields: FormField[]; initial?: Record<string, string>; submitLabel: string;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  function change(name: string, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setResult({});
  }
  return <form className="medical-form" noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const validation: Record<string, string> = {};
    fields.forEach((field) => {
      const value = values[field.name]?.trim() ?? '';
      if (field.required && !value) validation[field.name] = field.label + ' là bắt buộc';
      if (field.maxLength && value.length > field.maxLength) validation[field.name] = `${field.label} tối đa ${field.maxLength} ký tự`;
      if (field.type === 'number' && value && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) validation[field.name] = 'Nhập mã số dương';
      if (field.type === 'date' && value && !validDate(value)) validation[field.name] = 'Nhập ngày hợp lệ';
      if (field.options && value && !field.options.includes(value)) validation[field.name] = 'Chọn một lựa chọn hợp lệ';
    });
    setErrors(validation); setResult({});
    if (Object.keys(validation).length) return;
    submitting.current = true; setPending(true);
    try { await onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))); setResult({ success: 'Đã lưu thành công' }); }
    catch (error) { setResult({ error: medicalErrorMessage(error, 'Không lưu được. Hãy thử lại.') }); }
    finally { submitting.current = false; setPending(false); }
  }}>
    <p className="text-caption">Điền đầy đủ các trường bắt buộc. Dữ liệu chỉ được lưu khi máy chủ xác nhận.</p>
    <div className="medical-form-fields">{fields.map((field) => <div key={field.name} className={field.type === 'textarea' ? 'medical-form-wide' : undefined}>{field.options ?
      <SelectField label={field.label} aria-label={field.label} required={field.required} options={field.options.map((value) => ({ value, label: viLabel(value) }))} placeholder="Chọn…" value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} /> :
      field.type === 'textarea' ? <TextAreaField label={field.label} aria-label={field.label} required={field.required} maxLength={field.maxLength} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} /> :
      <TextField label={field.label} aria-label={field.label} required={field.required} maxLength={field.maxLength} type={field.type ?? 'text'} min={field.type === 'number' ? 1 : undefined} step={field.type === 'number' ? 1 : undefined} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} />}</div>)}</div>
    {result.error && <AlertBanner type="danger" title={result.error} />}
    {result.success && <AlertBanner type="success" title={result.success} />}
    <div className="medical-actions">
      <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : submitLabel}</Button>
      {onCancel && <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Hủy</Button>}
    </div>
  </form>;
}
