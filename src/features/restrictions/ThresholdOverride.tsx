import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Card, ErrorState, KeyValue, LoadingState, Modal, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { dateTime } from '../evaluation/models';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createThresholdApi, validThreshold } from './thresholdApi';
import styles from '../main-flows/flow.module.css';

/** SCR-MED-014. Mounted only for Vet; other readers retain the existing effective threshold read. */
export function ThresholdOverride({ horseId }: { horseId: number }) {
  const { user } = useAuth();
  return user?.roles.includes('VETERINARIAN') ? <VetThresholdOverride key={horseId} horseId={horseId} /> : null;
}
function VetThresholdOverride({ horseId }: { horseId: number }) {
  const request = useFlowRequest(), api = useMemo(() => createThresholdApi(request), [request]);
  const load = useCallback((signal: AbortSignal) => api.read(horseId, signal), [api, horseId]);
  const resource = useResource(load), current = resource.data?.find((item) => item.metricType === 'HEART_RATE');
  const [open, setOpen] = useState(false), [stage, setStage] = useState<'edit' | 'set' | 'end'>('edit');
  const [value, setValue] = useState(''), [reason, setReason] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false); const pending = useRef(false);
  const validTime = (text: string) => !!text && Number.isFinite(new Date(text).getTime());
  const canSet = validThreshold(value) && validTime(from) && reason.length <= 1000;
  const canEnd = current?.scope === 'HORSE_OVERRIDE' && validTime(to) && (!current.effectiveFrom || new Date(to).getTime() >= Date.parse(current.effectiveFrom));
  const close = () => { if (!pending.current) { setOpen(false); setStage('edit'); setError(''); } };
  async function confirm() {
    if (pending.current || (stage === 'set' ? !canSet : stage !== 'end' || !canEnd)) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (stage === 'set') await api.set(horseId, { metricType: 'HEART_RATE', thresholdValue: Number(value), effectiveFrom: new Date(from).toISOString(), reason });
      else await api.end(horseId, new Date(to).toISOString());
      setMessage('Threshold operation confirmed by the server. Reloading the effective value.'); resource.reload();
      setOpen(false); setStage('edit'); setValue(''); setReason(''); setFrom(''); setTo('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Card title="Medical alert threshold"><div className={styles.stack}>
    {resource.pending && <LoadingState label="Loading effective threshold…" />}
    {resource.error && <ErrorState title="Threshold unavailable" description={resource.error} onRetry={resource.reload} />}
    {message && <AlertBanner type="success" title="Threshold request confirmed">{message}</AlertBanner>}
    <KeyValue label="Effective heart-rate critical threshold" value={current ? `${current.thresholdValue} bpm · ${current.scope}` : 'Not provided'} />
    <Button variant="secondary" disabled={resource.pending || !!resource.error} onClick={() => { setError(''); setMessage(''); setStage('edit'); setOpen(true); }}>Threshold Override</Button>
    <Modal open={open} onClose={close} title={stage === 'edit' ? `Threshold Override · Horse ${horseId}` : stage === 'set' ? 'Confirm threshold override' : 'Confirm end of threshold override'} footer={<>
      <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
      {stage === 'edit' ? <><Button variant="secondary" disabled={!canEnd || resource.pending || !!resource.error} onClick={() => setStage('end')}>Review end override</Button><Button disabled={!canSet || resource.pending || !!resource.error} onClick={() => setStage('set')}>Review override</Button></>
        : <><Button variant="secondary" disabled={busy} onClick={() => { setStage('edit'); setError(''); }}>Back to edit</Button><Button disabled={busy || resource.pending || !!resource.error || (stage === 'set' ? !canSet : !canEnd)} onClick={() => void confirm()}>{busy ? 'Saving…' : stage === 'set' ? 'Confirm override' : 'Confirm end override'}</Button></>}
    </>}><div className={styles.stack}>
      <AlertBanner type="danger" title="Veterinarian authority only">This changes the horse’s critical heart-rate threshold. Trainers and Head Trainers cannot edit it.</AlertBanner>
      {error && <AlertBanner type="danger" title="Threshold not confirmed">{error}</AlertBanner>}
      <KeyValue label="Metric" value="Heart rate · critical threshold" /><KeyValue label="Current effective value" value={current ? `${current.thresholdValue} bpm · ${current.scope}` : 'Not provided'} />
      <KeyValue label="Global default" value={current?.scope === 'GLOBAL' ? `${current.thresholdValue} bpm` : 'Not provided by the effective-threshold API'} />
      {stage === 'edit' ? <fieldset disabled={busy} className={`${styles.fieldset} ${styles.stack}`}>
        <TextField label="Override threshold (bpm)" type="number" min="0.01" max="99999.99" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} helperText="Positive value, at most two decimals. No default is assumed." />
        <TextField label="Effective from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} required />
        <TextAreaField label="Override reason" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <TextField label="End override at" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} disabled={current?.scope !== 'HORSE_OVERRIDE'} helperText={current?.effectiveFrom ? `Must be on or after ${dateTime(current.effectiveFrom)}.` : 'An existing horse override is required. The server validates its effective interval.'} />
        <p>Leaving the value empty does not remove an override. Ending it requires a separate confirmation.</p>
      </fieldset> : <><KeyValue label={stage === 'set' ? 'New critical threshold' : 'End override'} value={stage === 'set' ? `${value} bpm · ${dateTime(new Date(from).toISOString())}` : dateTime(new Date(to).toISOString())} />
        {stage === 'set' && <KeyValue label="Reason" value={reason.trim() || 'Not provided'} />}
        <p>{stage === 'set' ? 'The server replaces the open override atomically and checks conflicting effective intervals.' : 'The server ends the open override and resolves the effective threshold again. No global value is assumed here.'}</p></>}
      <p className="text-caption">Warning threshold is not provided. No warning value or severity is calculated in the browser.</p>
    </div></Modal>
  </div></Card>;
}
