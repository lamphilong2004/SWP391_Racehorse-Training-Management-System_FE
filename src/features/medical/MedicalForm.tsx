import { useState } from 'react';
import { AlertBanner, Button, SelectField, TextField } from '../../design-system';
import { MedicalTextArea } from './MedicalTextArea';

export interface FormField { name: string; label: string; required?: boolean; type?: string; options?: string[] }
export function MedicalForm({ fields, initial = {}, submitLabel, onSave }: {
  fields: FormField[]; initial?: Record<string, string>; submitLabel: string;
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [pending, setPending] = useState(false);
  return <form className="medical-form" noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const validation: Record<string, string> = {};
    fields.forEach((field) => {
      const value = values[field.name]?.trim() ?? '';
      if (field.required && !value) validation[field.name] = field.label + ' is required';
      if (field.type === 'number' && value && !Number.isFinite(Number(value))) validation[field.name] = 'Enter a finite number';
      if (field.type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) validation[field.name] = 'Enter a valid date';
    });
    setErrors(validation); setResult({});
    if (Object.keys(validation).length) return;
    setPending(true);
    try { await onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))); setResult({ success: 'Saved successfully' }); }
    catch (error) { setResult({ error: error instanceof Error ? error.message : 'Unable to save. Please retry.' }); }
    finally { setPending(false); }
  }}>
    {fields.map((field) => field.options ?
      <SelectField key={field.name} label={field.label} options={field.options.map((value) => ({ value, label: value }))} placeholder="Select…" value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> :
      field.type === 'textarea' ? <MedicalTextArea key={field.name} label={field.label} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> :
      <TextField key={field.name} label={field.label} type={field.type ?? 'text'} step={field.type === 'number' ? 'any' : undefined} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />)}
    {result.error && <AlertBanner type="danger" title={result.error} />}
    {result.success && <AlertBanner type="success" title={result.success} />}
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
  </form>;
}
