import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, ErrorState, Icon, LoadingState, StatusBadge, TextAreaField, TextField } from '../../design-system';
import type { HealthStatus, HorseDetail } from '../horses/api/types';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createBaselineApi, validateWeight, type BaselineRecord } from './baselineApi';
import styles from '../main-flows/flow.module.css';

const HEALTH: HealthStatus[] = ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'];
interface Activation { checklist: { id: string; label: string; requirement?: string; state?: string; satisfied?: boolean }[] }
export function BaselinePage() {
  const { id } = useParams();
  return <BaselineContent key={id} rawId={id} />;
}
function BaselineContent({ rawId }: { rawId?: string }) {
  const request = useFlowRequest();
  const api = useMemo(() => createBaselineApi(request), [request]);
  const loadHorse = useCallback((signal: AbortSignal) => request<HorseDetail>(`/api/horses/${idOf(rawId)}`, { signal }), [request, rawId]);
  const loadActivation = useCallback((signal: AbortSignal) => request<Activation>(`/api/horses/${idOf(rawId)}/activation-status`, { signal }), [request, rawId]);
  const horse = useResource(loadHorse), activation = useResource(loadActivation);
  const [weight, setWeight] = useState(''), [health, setHealth] = useState<HealthStatus | ''>('');
  const [condition, setCondition] = useState(''), [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<BaselineRecord>();
  const pending = useRef(false);
  const data = horse.data;
  const valid = validateWeight(weight) && HEALTH.includes(health as HealthStatus) && !!condition.trim();
  async function save() {
    if (pending.current || !valid || !data || data.lifecycle !== 'DRAFT') return;
    pending.current = true; setSaving(true); setError('');
    try {
      const result = await api.save(data.id, { weightKg: Number(weight), healthStatus: health as HealthStatus,
        clinicalNotes: `${condition.trim()}${notes.trim() ? `\n\nVeterinarian notes: ${notes.trim()}` : ''}` });
      if (!result?.id || result.horseId !== data.id || !result.recordedAt) throw new Error('The server did not confirm the saved baseline. Reload the horse before retrying.');
      setSaved(result); activation.reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <FlowShell title={`Initial Health Baseline${data ? ` · ${data.name}` : ''}`} description={data ? `${data.horseCode} · ${data.breed ?? 'Breed not recorded'} · ${data.currentBoxCode ?? 'Box not assigned'} · onboarding (horse registration)` : 'Veterinarian baseline examination'} section="Horses" role="VETERINARIAN" actions={data && <StatusBadge family="lifecycle" status={data.lifecycle} />}>
    {horse.pending && <LoadingState label="Loading horse…" />}
    {horse.error && <ErrorState title="Horse unavailable" description={horse.error} onRetry={horse.reload} />}
    {error && <AlertBanner type="danger" title="Baseline not saved">{error}</AlertBanner>}
    {saved && <AlertBanner type="success" title="Baseline saved">{saved.weightKg} kg · {saved.healthStatus} · {new Date(saved.recordedAt).toLocaleString()}. <ButtonLink to={`/horses/${saved.horseId}`}>Reload horse profile</ButtonLink></AlertBanner>}
    {data && data.lifecycle !== 'DRAFT' && !saved && <AlertBanner type="info" title="Initial baseline is for DRAFT horses">Open this horse’s medical record for ongoing examinations.</AlertBanner>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className={styles.columns}><Card title="Baseline examination"><fieldset disabled={!data || data.lifecycle !== 'DRAFT' || saving || !!saved} className={`${styles.fieldset} ${styles.stack}`}>
        <p className={styles.muted}>The first examination of a new horse. It records weight and condition and sets the first Health Status.</p>
        <div className={styles.fields}><TextField label="Examination date & time" value={saved ? new Date(saved.recordedAt).toLocaleString() : ''} readOnly placeholder="Recorded by server on save" helperText="The approved API sets the examination time when the baseline is saved." /><TextField label="Weight (kg)" required type="number" min="0.01" max="9999.99" step="0.01" value={weight} placeholder="Enter weight" onChange={(event) => setWeight(event.target.value)} error={weight && !validateWeight(weight) ? 'Enter a positive weight up to 9999.99 kg with at most two decimals.' : undefined} /></div>
        <TextAreaField label="Current condition" required value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="General and body condition, legs and hooves, anything unusual…" rows={4} />
        <fieldset className={styles.fieldset}><legend className="text-body-strong">Initial Health Status *</legend><div className={styles.choices}>{HEALTH.map((value) => <label className={styles.choice} key={value}><input required type="radio" name="healthStatus" value={value} checked={health === value} onChange={() => setHealth(value)} /><StatusBadge family="health" status={value} /></label>)}</div><p className="text-caption">{health || 'Not selected yet.'}</p></fieldset>
        <TextAreaField label="Veterinarian notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes…" rows={2} />
        <AlertBanner type="info" title="">This form sets the first Health Status only. Training Availability is managed separately by the Veterinarian from the medical record.</AlertBanner>
      </fieldset></Card><Card title="Activation readiness"><div className={styles.stack}><p className={styles.muted}>The horse becomes ACTIVE automatically once all mandatory requirements are valid. Head Trainer readiness review is recommended and does not block activation.</p>
        {activation.pending && <LoadingState label="Loading readiness…" />}{activation.error && <ErrorState title="Readiness unavailable" description={activation.error} onRetry={activation.reload} />}
        {activation.data?.checklist.map((item) => <div className={styles.checklist} key={item.id}><Icon name={item.state === 'SATISFIED' || item.state === 'REVIEWED' || item.satisfied ? 'check-circle' : 'circle'} size={16} /><div><p>{item.label}</p><span className="text-caption">{item.requirement ?? 'Server readiness result'}</span></div></div>)}
        <div className={styles.row}><StatusBadge family="lifecycle" status="DRAFT" /><Icon name="chevron-right" size={16} /><StatusBadge family="lifecycle" status="ACTIVE" /></div>
      </div></Card></div>
      <div className={styles.footer}><span className="text-caption">Complete the required fields to save.</span><ButtonLink to={rawId ? `/horses/${rawId}` : '/horses'}>Cancel</ButtonLink><Button type="submit" disabled={!valid || !data || data.lifecycle !== 'DRAFT' || saving || !!saved}>{saving ? 'Saving…' : 'Save Baseline'}</Button></div>
    </form>
  </FlowShell>;
}
