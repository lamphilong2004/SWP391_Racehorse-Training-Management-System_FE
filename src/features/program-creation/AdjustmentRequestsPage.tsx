import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApplyAdjustmentModal } from './ApplyAdjustmentModal';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, Modal, SelectField, StatusBadge, TextAreaField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { dateTime } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { ADJUSTMENT_TYPES, createProgramManagementApi, type AdjustmentRequest, type AdjustmentStatus } from './programManagementApi';
import styles from '../main-flows/flow.module.css';

const typeLabel = (value: string) => ADJUSTMENT_TYPES.find((item) => item.value === value)?.label ?? value;

/** SCR-TRAIN-024 "Review Trainer Request": Head Trainer decides; a Trainer sees only their own requests (server scope). */
export function AdjustmentRequestsPage() {
  const { user } = useAuth(), request = useFlowRequest(), api = useMemo(() => createProgramManagementApi(request), [request]);
  const headTrainer = user?.roles.includes('HEAD_TRAINER') ?? false;
  const [status, setStatus] = useState<AdjustmentStatus | ''>('PENDING'), [page, setPage] = useState(0);
  const [decision, setDecision] = useState<{ item: AdjustmentRequest; approve: boolean } | null>(null);
  const [applying, setApplying] = useState<AdjustmentRequest | null>(null), [applied, setApplied] = useState<{ item: AdjustmentRequest; programName: string } | null>(null);
  const load = useCallback((signal: AbortSignal) => api.adjustments({ status, page }, signal), [api, status, page]);
  const resource = useResource(load), data = resource.data;
  return <FlowShell title="Program Adjustment Requests" description={headTrainer ? 'Review strategic changes requested by Trainers. Approving records the decision; apply approved changes to the program deliberately.' : 'Your strategic change requests and the Head Trainer decisions.'}
    section="Horse Training Programs" role={headTrainer ? 'HEAD_TRAINER' : 'TRAINER'}>
    {applied && <AlertBanner type="success" title="Adjustment applied">{applied.programName} now uses the adjusted phases. <Link to={`/training/programs/${applied.item.programId}`}>Open the program</Link></AlertBanner>}
    <Card><div className={styles.row}>
      <SelectField label="Status" value={status} onChange={(event) => { setStatus(event.target.value as AdjustmentStatus | ''); setPage(0); }}
        options={[{ value: '', label: 'All' }, { value: 'PENDING', label: 'PENDING' }, { value: 'APPROVED', label: 'APPROVED' }, { value: 'REJECTED', label: 'REJECTED' }]} />
      <Button variant="secondary" onClick={resource.reload}>Refresh</Button>
    </div></Card>
    {resource.pending && <LoadingState label="Loading adjustment requests…" />}
    {resource.error && <ErrorState title="Adjustment requests unavailable" description={resource.error} onRetry={resource.reload} />}
    {data && <div className={styles.table}><DataTable<AdjustmentRequest> caption="Program adjustment requests, newest first" rows={data.items} rowKey={(item) => item.id}
      empty={<EmptyState title="No adjustment requests" description={status ? `No ${status} requests.` : 'No requests have been submitted.'} />} columns={[
        { key: 'program', header: 'Program', render: (item) => <Link to={`/training/programs/${item.programId}`}>{item.horse ? `${item.horse.name} · ${item.horse.horseCode}` : `Program ${item.programId}`}</Link> },
        { key: 'type', header: 'Change', render: (item) => typeLabel(item.requestType) },
        { key: 'request', header: 'Requested', render: (item) => <div><p>{item.requestedValue}</p>{item.currentValue && <p className={styles.muted}>Current: {item.currentValue}</p>}</div> },
        { key: 'reason', header: 'Reason', render: (item) => <div><p>{item.reason}</p>{item.evidenceNotes && <p className={styles.muted}>Evidence: {item.evidenceNotes}</p>}</div> },
        { key: 'by', header: 'Requested by', render: (item) => <span>{item.requestedBy.fullName}<br /><span className={styles.muted}>{dateTime(item.requestedAt)}</span></span> },
        { key: 'status', header: 'Status', render: (item) => <span><StatusBadge family="adjustment" status={item.status} />{item.decisionReason && <><br /><span className={styles.muted}>{item.decisionReason}</span></>}</span> },
        ...(headTrainer ? [{ key: 'actions', header: 'Decision', render: (item: AdjustmentRequest) => item.status === 'PENDING'
          ? <div className={styles.row}><Button size="sm" onClick={() => setDecision({ item, approve: true })}>Approve</Button><Button size="sm" variant="secondary" onClick={() => setDecision({ item, approve: false })}>Reject</Button></div>
          : <div className={styles.stack}><span>{item.reviewedBy ? `${item.reviewedBy.fullName}, ${dateTime(item.reviewedAt ?? undefined)}` : 'Decided'}</span>
            {item.status === 'APPROVED' && <Button size="sm" variant="secondary" onClick={() => { setApplied(null); setApplying(item); }}>Apply to phases</Button>}</div> }] : []),
      ]} />
      <div className={styles.row}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {data.page + 1} of {Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>
    </div>}
    {applying && <ApplyAdjustmentModal item={applying} onClose={() => setApplying(null)} onApplied={(program) => { setApplied({ item: applying, programName: `${program.horse.name} · ${program.name}` }); setApplying(null); resource.reload(); }} />}
    {decision && <DecisionModal item={decision.item} approve={decision.approve} onClose={() => setDecision(null)} onDone={() => { setDecision(null); resource.reload(); }} />}
  </FlowShell>;
}

function DecisionModal({ item, approve, onClose, onDone }: { item: AdjustmentRequest; approve: boolean; onClose: () => void; onDone: () => void }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramManagementApi(request), [request]);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!approve && !reason.trim()) { setError('Give the Trainer a reason for the rejection.'); return; }
    setBusy(true); setError('');
    try { await (approve ? api.approve(item.id, reason.trim()) : api.reject(item.id, reason.trim())); onDone(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  const title = approve ? 'Approve adjustment request' : 'Reject adjustment request';
  return <Modal open title={title} dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="adjustment-decision-form" variant={approve ? 'primary' : 'destructive'} disabled={busy}>{busy ? 'Saving…' : approve ? 'Approve' : 'Reject'}</Button></>}>
    <form id="adjustment-decision-form" onSubmit={submit} className={styles.stack}>
      <p><strong>{typeLabel(item.requestType)}</strong>: {item.requestedValue}</p>
      <p className={styles.muted}>Reason: {item.reason}</p>
      {approve && <AlertBanner type="info" title="Approval records the decision">The Trainer is notified. Then use “Apply to phases” on the approved request to change the program.</AlertBanner>}
      <TextAreaField label={approve ? 'Decision note (optional)' : 'Rejection reason'} required={!approve} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {error && <AlertBanner type="danger" title="Decision not saved">{error}</AlertBanner>}
    </form>
  </Modal>;
}
