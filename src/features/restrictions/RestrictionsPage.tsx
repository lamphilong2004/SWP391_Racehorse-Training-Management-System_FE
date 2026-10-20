import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { HorseDetail, Page } from '../horses/api/types';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createRestrictionApi, rulePayload, type Availability, type ExerciseRule, type Restriction } from './restrictionApi';
import { ThresholdOverride } from './ThresholdOverride';
import styles from '../main-flows/flow.module.css';

export function RestrictionsPage() {
  const [params, setParams] = useSearchParams(), { user } = useAuth(), request = useFlowRequest();
  const horseId = params.get('horseId'); const canEdit = user?.roles.includes('VETERINARIAN') ?? false;
  const [page, setPage] = useState(0);
  const api = useMemo(() => createRestrictionApi(request), [request]);
  const loadHorses = useCallback((signal: AbortSignal) => request<Page<HorseDetail>>(`/api/horses?page=${page}&size=20`, { signal }), [request, page]);
  const loadRestrictions = useCallback((signal: AbortSignal) => !horseId ? api.list(signal) : Promise.resolve(null), [api, horseId]);
  const horses = useResource(loadHorses);
  const restrictions = useResource(loadRestrictions);
  return <FlowShell title={!horseId ? 'Training Restrictions' : canEdit ? 'Set Training Availability' : 'Training Restriction Status'} description="Training Availability and operational restriction reasons" section="Restrictions" role={canEdit ? 'VETERINARIAN' : user?.roles.find((role) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER'].includes(role)) ?? 'TRAINER'}>
    <SelectField label="Horse" value={horseId ?? ''} options={[{ value: '', label: 'Choose a horse' }, ...(horses.data?.items.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.horseCode}` })) ?? []), ...(horseId && !horses.data?.items.some((item) => String(item.id) === horseId) ? [{ value: horseId, label: `Horse ${horseId}` }] : [])]} onChange={(event) => setParams(event.target.value ? { horseId: event.target.value } : {})} />
    {horses.error && <ErrorState title="Horse picker unavailable" description={horses.error} onRetry={horses.reload} />}
    {horseId ? <RestrictionContent key={horseId} horseId={horseId} canEdit={canEdit} /> : <><AlertBanner type="info" title={canEdit ? 'Veterinarian control' : 'Read-only'}>Only the Veterinarian sets Training Availability. LOCKED horses cannot start a program or session; LIMITED horses train only within permitted work.</AlertBanner>{horses.pending && <LoadingState label="Loading horse availability…" />}{restrictions.error && <ErrorState title="Restriction reasons unavailable" description={restrictions.error} onRetry={restrictions.reload} />}{horses.data && <Card title="Training Availability"><div className={styles.row}>{(['AVAILABLE', 'LIMITED', 'LOCKED'] as const).map((status) => <span key={status}><StatusBadge family="availability" status={status} /> {horses.data!.items.filter((item) => item.trainingAvailability === status).length}</span>)}<span className="text-caption">Counts on this page</span></div><div className={styles.table}><DataTable<HorseDetail> caption="Horse restrictions" rows={horses.data.items} rowKey={(item) => item.id} columns={[
      { key: 'horse', header: 'Horse', render: (item) => <Link to={`/medical/restrictions?horseId=${item.id}`}>{item.name}<br />{item.horseCode}</Link> },
      { key: 'health', header: 'Health status', render: (item) => item.healthStatus ? <StatusBadge family="health" status={item.healthStatus} /> : 'Baseline pending' },
      { key: 'availability', header: 'Training Availability', render: (item) => <StatusBadge family="availability" status={item.trainingAvailability} /> },
      { key: 'reason', header: 'Restriction reason', render: (item) => restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.reason ?? (item.trainingAvailability === 'AVAILABLE' ? 'No active restriction' : 'Open horse for current reason') },
      { key: 'effective', header: 'Effective', render: (item) => restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.effectiveAt ?? 'Not provided' },
      { key: 'review', header: 'Review', render: (item) => restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.reviewDate ?? 'Not provided' },
    ]} /></div><div className={styles.footer}><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={page + 1 >= horses.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></Card>}</>}
  </FlowShell>;
}
function RestrictionContent({ horseId, canEdit }: { horseId: string; canEdit: boolean }) {
  const request = useFlowRequest(), api = useMemo(() => createRestrictionApi(request), [request]);
  const load = useCallback((signal: AbortSignal) => api.availability(idOf(horseId), signal), [api, horseId]);
  const availability = useResource(load);
  const activeId = availability.data?.activeRestrictionId;
  const loadRecord = useCallback((signal: AbortSignal) => activeId ? api.find(activeId, signal) : Promise.resolve(null), [api, activeId]);
  const record = useResource(loadRecord);
  return <div className={styles.stack}>{availability.pending && <LoadingState label="Loading availability…" />}{availability.error && <ErrorState title="Availability unavailable" description={availability.error} onRetry={availability.reload} />}
    {availability.data && <>{!canEdit && <AlertBanner type="info" title="Read-only">Training Availability and restrictions are set by the Veterinarian. You can see them but cannot change them.</AlertBanner>}
      {record.error && <ErrorState title="Restriction details unavailable" description={record.error} onRetry={record.reload} />}
      {canEdit && <ThresholdOverride horseId={idOf(horseId)} />}
      <div className={canEdit ? styles.stack : styles.fields}><Card title={canEdit ? 'Training Availability — Veterinarian control' : 'Current Restriction'}><div className={styles.stack}><div className={styles.row}>Current: <StatusBadge family="availability" status={availability.data.availability} /></div><KeyValue label="Reason · shown to Head Trainer and Trainer" value={availability.data.reason ?? (availability.data.availability === 'AVAILABLE' ? 'No active medical restriction' : 'Reason unavailable')} /><div className={styles.fields}><KeyValue label="Effective" value={record.data?.effectiveAt ?? 'Not provided'} /><KeyValue label="Next Review" value={record.data?.reviewDate ?? 'Not provided'} /></div>
        <div className={styles.fields}>{(['ALLOWED', 'PROHIBITED'] as const).map((kind) => <AlertBanner key={kind} type={kind === 'ALLOWED' ? 'success' : 'danger'} title={kind === 'ALLOWED' ? 'PERMITTED' : 'PROHIBITED'}>{availability.data!.exerciseRules?.filter((item) => item.ruleType === kind).map((item, index) => <p key={index}>{item.exerciseTypeNote ?? `Exercise ${item.exerciseId}`}</p>)}{!availability.data!.exerciseRules?.some((item) => item.ruleType === kind) && <p>No rules returned.</p>}</AlertBanner>)}</div>
        {canEdit && !record.pending && <RestrictionEditor key={`${activeId ?? 'new'}:${record.data?.id ?? ''}`} current={availability.data} record={record.data ?? undefined} onSaved={() => { availability.reload(); record.reload(); }} />}
      </div></Card><Card title={canEdit ? 'Effect on Training' : 'Trainer Guidance'}><div className={styles.stack}><p>Remove a prohibited exercise or replace it with a permitted exercise, then revalidate.</p><p>Trainers cannot override a Veterinarian restriction.</p><p>LOCKED blocks scheduling and starting. LIMITED is evaluated against the server’s ALLOWED and PROHIBITED rules.</p><p>Review dates are reminders and never lift restrictions automatically.</p><Link to="/training/calendar">See Effect in Training →</Link></div></Card></div>
    </>}
  </div>;
}
function RestrictionEditor({ current, record, onSaved }: { current: Availability; record?: Restriction; onSaved: () => void }) {
  const request = useFlowRequest(), api = useMemo(() => createRestrictionApi(request), [request]);
  const [level, setLevel] = useState(current.availability), [reason, setReason] = useState(current.reason ?? '');
  const [effectiveAt, setEffectiveAt] = useState(''), [reviewDate, setReviewDate] = useState('');
  const rulesKnown = current.exerciseRules !== undefined || record?.exerciseRules !== undefined || !current.activeRestrictionId;
  const [rules, setRules] = useState<ExerciseRule[]>(current.exerciseRules ?? record?.exerciseRules ?? []), [created, setCreated] = useState<Restriction>();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''); const pending = useRef(false);
  const activeId = created?.id ?? current.activeRestrictionId;
  async function save() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (level === 'AVAILABLE') {
        if (!activeId) throw new Error('There is no active restriction to lift.');
        await api.lift(activeId); setMessage('Restriction lifted by the server. Reloading availability.'); onSaved(); return;
      }
      if (level === 'LIMITED' && !rulesKnown) throw new Error('Exercise rules were not returned. Reload restriction details before replacing them.');
      const checked = rulePayload(rules);
      let restrictionId = activeId;
      if (restrictionId && level !== (created?.level ?? current.availability)) throw new Error('Lift the active restriction before creating a different level. The contract permits one active restriction.');
      if (!restrictionId) {
        if (!reason.trim()) throw new Error('Give the operational reason.');
        const effective = new Date(effectiveAt);
        if (!Number.isFinite(effective.getTime()) || effective.getTime() > Date.now()) throw new Error('Effective time must be valid and no later than now.');
        const result = await api.create(current.horseId, { level, reason, effectiveAt: effective.toISOString(), reviewDate: reviewDate || undefined });
        if (!result?.id || result.horseId !== current.horseId) throw new Error('The server did not confirm the restriction. Reload before retrying.');
        restrictionId = result.id; setCreated(result);
      }
      try { if (level === 'LIMITED') await api.rules(restrictionId, checked.rules); }
      catch (cause) { throw new Error(`Restriction ${restrictionId} exists, but its exercise rules were not confirmed. Retry saving rules or reload. ${errorMessage(cause)}`, { cause }); }
      setMessage('Training Availability and exercise rules saved.'); onSaved();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={(event) => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className={`${styles.fieldset} ${styles.stack}`}>
    <SelectField label="Training Availability" value={level} options={['AVAILABLE', 'LIMITED', 'LOCKED'].map((value) => ({ value, label: value }))} onChange={(event) => setLevel(event.target.value as typeof level)} />
    {error && <AlertBanner type="danger" title="Change not fully saved">{error}</AlertBanner>}{message && <AlertBanner type="success" title={message} />}
    {activeId && level !== 'AVAILABLE' && <p className="text-caption">The active reason, level and effective time are read-only. The approved API supports replacing exercise rules or explicitly lifting the restriction.</p>}
    {level === 'LIMITED' && !rulesKnown && <AlertBanner type="warning" title="Exercise rules unavailable">Reload restriction details before replacing rules. The current server rules will be preserved.</AlertBanner>}
    {level !== 'AVAILABLE' && <><TextAreaField label="Reason" required maxLength={1000} readOnly={!!activeId} value={reason} onChange={(event) => setReason(event.target.value)} helperText="Operational wording shown to Trainers; no prescription or case diagnosis." />{!activeId && <div className={styles.fields}><TextField label="Effective time" type="datetime-local" required value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /><TextField label="Next review" type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></div>}
      {level === 'LIMITED' && <><h3 className="text-h3">Exercise rules</h3>{rules.map((item, index) => <div className={styles.row} key={index}><SelectField label="Rule" value={item.ruleType} options={[{ value: 'ALLOWED', label: 'Permitted (ALLOWED)' }, { value: 'PROHIBITED', label: 'PROHIBITED' }]} onChange={(event) => setRules(rules.map((value, i) => i === index ? { ...value, ruleType: event.target.value as ExerciseRule['ruleType'] } : value))} /><TextField label={item.exerciseId ? 'Exercise ID' : 'Exercise type note'} maxLength={200} readOnly={!!item.exerciseId} value={item.exerciseId ?? item.exerciseTypeNote ?? ''} onChange={(event) => setRules(rules.map((value, i) => i === index ? { ruleType: value.ruleType, exerciseTypeNote: event.target.value } : value))} /><Button type="button" variant="tertiary" onClick={() => setRules(rules.filter((_, i) => i !== index))}>Remove rule</Button></div>)}<Button type="button" variant="secondary" onClick={() => setRules([...rules, { ruleType: 'PROHIBITED', exerciseTypeNote: '' }])}>Add exercise rule</Button></>}
      {record?.effectiveAt && <KeyValue label="Effective time" value={record.effectiveAt} />}
    </>}
    <div className={styles.row}><Link to={`/horses/${current.horseId}`}>Cancel</Link><Button type="submit" disabled={(level === 'AVAILABLE' && !activeId) || (level === 'LIMITED' && !rulesKnown)}>{busy ? 'Saving…' : level === 'AVAILABLE' ? 'Lift restriction' : 'Save Training Availability'}</Button></div>
  </fieldset></form>;
}
