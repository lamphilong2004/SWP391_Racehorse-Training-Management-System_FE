import { useRef, useState } from 'react';
import { AlertBanner, Button, SelectField } from '../../design-system';
import { errorMessage } from '../main-flows/api';
import type { Intensity } from '../program-creation/programTypes';
import type { createSessionApi, TrainingSession } from './sessionApi';

export function ReduceIntensity({ api, session, onSaved }: { api: ReturnType<typeof createSessionApi>; session: TrainingSession; onSaved: () => void }) {
  const [value, setValue] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), order: Intensity[] = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
  const lower = order.slice(0, Math.max(0, order.indexOf(session.intensity as Intensity)));
  async function reduce() {
    if (pending.current || !lower.includes(value as Intensity)) return;
    pending.current = true; setBusy(true); setError('');
    try { await api.reduceIntensity(session.id, value as Intensity); setValue(''); onSaved(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    {error && <AlertBanner type="danger" title="Intensity unchanged">{error}</AlertBanner>}
    <SelectField label="Lower session intensity" value={value} placeholder="Choose a lower intensity" disabled={busy || !lower.length || session.trainingAvailability === 'LOCKED'}
      options={lower.map((intensity) => ({ value: intensity, label: intensity.replaceAll('_', ' ') }))} onChange={(event) => setValue(event.target.value)} />
    <Button disabled={busy || !value || !lower.includes(value as Intensity) || session.trainingAvailability === 'LOCKED'} onClick={() => void reduce()}>Reduce intensity</Button>
  </>;
}
