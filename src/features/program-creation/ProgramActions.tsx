import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { AlertBanner, Button, CandidateCard, Checkbox, EmptyState, ErrorState, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { ADJUSTMENT_TYPES, createProgramManagementApi } from './programManagementApi';
import type { ProgramDetail } from './programTypes';
import styles from '../main-flows/flow.module.css';

type StatusTarget = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
const STATUS_ACTIONS: Record<ProgramDetail['status'], { to: StatusTarget; label: string }[]> = {
  ACTIVE: [{ to: 'PAUSED', label: 'Pause program' }, { to: 'COMPLETED', label: 'Complete program' }],
  PAUSED: [{ to: 'ACTIVE', label: 'Resume program' }, { to: 'COMPLETED', label: 'Complete program' }],
  COMPLETED: [],
};

/** Head Trainer program management (CORE-021): status transitions and Trainer reassignment. */
export function HeadTrainerProgramActions({ program, onChanged }: { program: ProgramDetail; onChanged: () => void }) {
  const [status, setStatus] = useState<{ to: StatusTarget; label: string } | null>(null);
  const [reassign, setReassign] = useState(false);
  return <>
    {STATUS_ACTIONS[program.status].map((action) => <Button key={action.to} variant="secondary" onClick={() => setStatus(action)}>{action.label}</Button>)}
    {program.status !== 'COMPLETED' && <Button variant="secondary" onClick={() => setReassign(true)}>Reassign Trainer</Button>}
    {status && <StatusModal program={program} action={status} onClose={() => setStatus(null)} onDone={() => { setStatus(null); onChanged(); }} />}
    {reassign && <ReassignModal program={program} onClose={() => setReassign(false)} onDone={() => { setReassign(false); onChanged(); }} />}
  </>;
}

function StatusModal({ program, action, onClose, onDone }: { program: ProgramDetail; action: { to: StatusTarget; label: string }; onClose: () => void; onDone: () => void }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramManagementApi(request), [request]);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await api.setStatus(program.id, action.to, reason.trim()); onDone(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open title={action.label} dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="program-status-form" variant={action.to === 'COMPLETED' ? 'destructive' : 'primary'} disabled={busy}>{busy ? 'Saving…' : action.label}</Button></>}>
    <form id="program-status-form" onSubmit={submit} className={styles.stack}>
      <p>{program.horse.name} · {program.name}: {program.status} → {action.to}</p>
      {action.to === 'COMPLETED' && <AlertBanner type="warning" title="Completion is final">A completed program cannot be resumed. Session history and evaluations stay unchanged.</AlertBanner>}
      <TextAreaField label="Reason (optional)" maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {error && <AlertBanner type="danger" title="Status not changed">{error}</AlertBanner>}
    </form>
  </Modal>;
}

function ReassignModal({ program, onClose, onDone }: { program: ProgramDetail; onClose: () => void; onDone: () => void }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramManagementApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => {
    const template = await api.templateVersion(program.sourceTemplateId, program.sourceTemplateVersion, signal);
    return api.trainerCandidates(program.horse.id, template.version.id, signal);
  }, [api, program.horse.id, program.sourceTemplateId, program.sourceTemplateVersion]);
  const candidates = useResource(load);
  const [trainerId, setTrainerId] = useState(0), [effectiveFrom, setEffectiveFrom] = useState(''), [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const options = (candidates.data?.candidates ?? []).filter((item) => item.user.id !== program.currentTrainer?.id);
  const selected = options.find((item) => item.user.id === trainerId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!selected) { setError('Select a Trainer.'); return; }
    if (!effectiveFrom) { setError('Choose the date the new Trainer takes over.'); return; }
    if (selected.warnings.length > 0 && !acknowledged) { setError('Acknowledge the Trainer warnings before reassigning.'); return; }
    setBusy(true); setError('');
    try { await api.reassignTrainer(program.id, { trainerUserId: selected.user.id, effectiveFrom, reason: reason.trim() || undefined, warningsAcknowledged: acknowledged }); onDone(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open size="lg" title="Reassign Trainer" dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="program-reassign-form" disabled={busy || !selected}>{busy ? 'Saving…' : 'Reassign Trainer'}</Button></>}>
    <form id="program-reassign-form" onSubmit={submit} className={styles.stack}>
      <p>Current Trainer: {program.currentTrainer?.fullName ?? 'Not provided'}. The new assignment must start after the current one.</p>
      {candidates.pending && <LoadingState label="Loading Trainer candidates…" />}
      {candidates.error && <ErrorState title="Candidates unavailable" description={candidates.error} onRetry={candidates.reload} />}
      {candidates.data && (options.length === 0 ? <EmptyState title="No other active Trainer" description={candidates.data.emptyReason ?? 'Only the current Trainer is active.'} /> : options.map((candidate) => <CandidateCard key={candidate.user.id}
        name={candidate.user.fullName} subtitle={`Trainer${candidate.experienceLevel ? ` · ${candidate.experienceLevel}` : ''}`}
        tags={candidate.skills} facts={[{ label: 'Suitability', value: candidate.label.replaceAll('_', ' ') }, { label: 'Reasons', value: candidate.reasons.join(' · ') || 'Not provided' },
          ...(candidate.warnings.length ? [{ label: 'Warnings', value: candidate.warnings.join(' · ') }] : []), ...(candidate.hardBlock ? [{ label: 'Blocked', value: candidate.hardBlock }] : [])]}
        className={trainerId === candidate.user.id ? styles.selected : undefined}
        actions={<Button type="button" variant="secondary" aria-pressed={trainerId === candidate.user.id} disabled={busy || Boolean(candidate.hardBlock)} onClick={() => { setTrainerId(candidate.user.id); setAcknowledged(false); }}>
          {trainerId === candidate.user.id ? `Selected ${candidate.user.fullName}` : `Select ${candidate.user.fullName}`}</Button>} />))}
      <TextField label="New Trainer effective from" type="date" required value={effectiveFrom} disabled={busy} onChange={(event) => setEffectiveFrom(event.target.value)} />
      <TextAreaField label="Reassignment reason (optional)" maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {selected && selected.warnings.length > 0 && <Checkbox label="I acknowledge the Trainer warnings" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} />}
      {error && <AlertBanner type="danger" title="Trainer not reassigned">{error}</AlertBanner>}
    </form>
  </Modal>;
}

/** Trainer strategic change request (DEC-005, CORE-040): PENDING until the Head Trainer decides. */
export function TrainerAdjustmentAction({ program, onSubmitted }: { program: ProgramDetail; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false), [done, setDone] = useState(false);
  return <>
    <Button variant="secondary" disabled={program.status === 'COMPLETED'} onClick={() => { setDone(false); setOpen(true); }}>Request program adjustment</Button>
    {done && <span role="status">Adjustment request sent to the Head Trainer.</span>}
    {open && <AdjustmentModal program={program} onClose={() => setOpen(false)} onDone={() => { setOpen(false); setDone(true); onSubmitted(); }} />}
  </>;
}

function AdjustmentModal({ program, onClose, onDone }: { program: ProgramDetail; onClose: () => void; onDone: () => void }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramManagementApi(request), [request]);
  const [type, setType] = useState(''), [phaseId, setPhaseId] = useState(''), [current, setCurrent] = useState(''), [requested, setRequested] = useState('');
  const [reason, setReason] = useState(''), [evidence, setEvidence] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dirty = Boolean(type || phaseId || current || requested || reason || evidence);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!type || !requested.trim() || !reason.trim()) { setError('Choose a change type and describe the requested change and the reason.'); return; }
    setBusy(true); setError('');
    try {
      await api.requestAdjustment(program.id, { requestType: type, horseProgramPhaseId: phaseId ? Number(phaseId) : undefined, currentValue: current.trim() || undefined,
        requestedValue: requested.trim(), reason: reason.trim(), evidenceNotes: evidence.trim() || undefined });
      onDone();
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open size="lg" title="Request program adjustment" dismissible={!busy && !dirty} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="program-adjustment-form" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button></>}>
    <form id="program-adjustment-form" onSubmit={submit} className={styles.stack}>
      <AlertBanner type="info" title="Strategic changes need Head Trainer approval">Session-level changes (exercises, distance, duration, date/time, Work Rider) stay in session planning. This request does not change the program until the Head Trainer decides.</AlertBanner>
      <SelectField label="Change type" required placeholder="Select change type" options={ADJUSTMENT_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={type} disabled={busy} onChange={(event) => setType(event.target.value)} />
      <SelectField label="Phase (optional)" placeholder="Whole program" options={[...program.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase) => ({ value: String(phase.id), label: `${phase.phaseOrder}. ${phase.name}` }))} value={phaseId} disabled={busy} onChange={(event) => setPhaseId(event.target.value)} />
      <TextAreaField label="Current value (optional)" maxLength={1000} value={current} disabled={busy} onChange={(event) => setCurrent(event.target.value)} />
      <TextAreaField label="Requested change" required maxLength={1000} value={requested} disabled={busy} onChange={(event) => setRequested(event.target.value)} />
      <TextAreaField label="Reason" required maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <TextAreaField label="Evidence notes (optional)" maxLength={2000} value={evidence} disabled={busy} onChange={(event) => setEvidence(event.target.value)} />
      {error && <AlertBanner type="danger" title="Request not sent">{error}</AlertBanner>}
    </form>
  </Modal>;
}
