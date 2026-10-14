import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, SelectField, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction } from '../../shared/hooks/useApi';
import { ActionError, Grid, Row, Stack } from '../../shared/ui/common';
import { horsesApi } from '../demoApi';

const SEX = ['Colt', 'Filly', 'Stallion', 'Mare', 'Gelding'].map((v) => ({ value: v, label: v }));

/** SCR-HORSE-003 step 1 — identity (Flow 1 step 1.1). Creates the horse as DRAFT. */
export function HorseCreatePage() {
  const navigate = useNavigate();
  const action = useAction();
  const [form, setForm] = useState({ horseCode: '', name: '', breed: 'Thoroughbred', sex: '', foaledDate: '', countryOfOrigin: '', registrationNo: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.horseCode.trim()) next.horseCode = 'Horse code is required.';
    if (!form.name.trim()) next.name = 'Name is required.';
    if (form.foaledDate && new Date(form.foaledDate) > new Date()) next.foaledDate = 'Foaled date cannot be in the future.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const created = await action.run(() =>
      horsesApi.create({ ...form, foaledDate: form.foaledDate || null, sex: form.sex || null, countryOfOrigin: form.countryOfOrigin || null, registrationNo: form.registrationNo || null }),
    );
    if (created) navigate(`/horses/${created.id}`, { replace: true });
  }

  return (
    <>
      <PageHeader title="Register horse" description="Step 1 — identity. The horse is saved as DRAFT and activates automatically when onboarding is complete." />
      <Card title="Identity">
        <form onSubmit={submit} noValidate>
          <Stack>
            <ActionError error={action.error} />
            <Grid cols={2}>
              <TextField label="Horse code" value={form.horseCode} onChange={set('horseCode')} error={errors.horseCode} placeholder="TB-001" />
              <TextField label="Name" value={form.name} onChange={set('name')} error={errors.name} placeholder="Thunder Bolt" />
              <TextField label="Breed" value={form.breed} onChange={set('breed')} />
              <SelectField label="Sex" value={form.sex} onChange={set('sex')} options={SEX} placeholder="Select sex" />
              <TextField label="Foaled date" type="date" value={form.foaledDate} onChange={set('foaledDate')} error={errors.foaledDate} />
              <TextField label="Country of origin" value={form.countryOfOrigin} onChange={set('countryOfOrigin')} />
              <TextField label="Registration no." value={form.registrationNo} onChange={set('registrationNo')} />
            </Grid>
            <Row>
              <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save as DRAFT'}</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/horses')}>Cancel</Button>
            </Row>
          </Stack>
        </form>
      </Card>
    </>
  );
}
