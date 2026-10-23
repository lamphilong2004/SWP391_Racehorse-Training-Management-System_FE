import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApplyAdjustmentModal } from './ApplyAdjustmentModal';
import { viLabel } from '../../shared/viLabels';
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
  return <FlowShell title="Yêu cầu điều chỉnh chương trình" description={headTrainer ? 'Xem xét các thay đổi chiến lược do Trainer đề xuất. Phê duyệt chỉ ghi nhận quyết định; hãy chủ động áp dụng thay đổi đã duyệt vào chương trình.' : 'Các yêu cầu thay đổi chiến lược của bạn và quyết định của Head Trainer.'}
    section="Chương trình huấn luyện ngựa" role={headTrainer ? 'HEAD_TRAINER' : 'TRAINER'}>
    {applied && <AlertBanner type="success" title="Đã áp dụng điều chỉnh">{applied.programName} đã dùng các giai đoạn mới điều chỉnh. <Link to={`/training/programs/${applied.item.programId}`}>Mở chương trình</Link></AlertBanner>}
    <Card><div className={styles.row}>
      <SelectField label="Trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as AdjustmentStatus | ''); setPage(0); }}
        options={[{ value: '', label: 'Tất cả' }, { value: 'PENDING', label: 'Chờ duyệt' }, { value: 'APPROVED', label: 'Đã duyệt' }, { value: 'REJECTED', label: 'Từ chối' }]} />
      <Button variant="secondary" onClick={resource.reload}>Làm mới</Button>
    </div></Card>
    {resource.pending && <LoadingState label="Đang tải yêu cầu điều chỉnh…" />}
    {resource.error && <ErrorState title="Không tải được yêu cầu điều chỉnh" description={resource.error} onRetry={resource.reload} />}
    {data && <div className={styles.table}><DataTable<AdjustmentRequest> caption="Yêu cầu điều chỉnh chương trình, mới nhất trước" rows={data.items} rowKey={(item) => item.id}
      empty={<EmptyState title="Chưa có yêu cầu điều chỉnh" description={status ? `Không có yêu cầu ở trạng thái ${viLabel(status)}.` : 'Chưa có yêu cầu nào được gửi.'} />} columns={[
        { key: 'program', header: 'Chương trình', render: (item) => <Link to={`/training/programs/${item.programId}`}>{item.horse ? `${item.horse.name} · ${item.horse.horseCode}` : `Chương trình ${item.programId}`}</Link> },
        { key: 'type', header: 'Thay đổi', render: (item) => typeLabel(item.requestType) },
        { key: 'request', header: 'Đề xuất', render: (item) => <div><p>{item.requestedValue}</p>{item.currentValue && <p className={styles.muted}>Hiện tại: {item.currentValue}</p>}</div> },
        { key: 'reason', header: 'Lý do', render: (item) => <div><p>{item.reason}</p>{item.evidenceNotes && <p className={styles.muted}>Căn cứ: {item.evidenceNotes}</p>}</div> },
        { key: 'by', header: 'Người đề xuất', render: (item) => <span>{item.requestedBy.fullName}<br /><span className={styles.muted}>{dateTime(item.requestedAt)}</span></span> },
        { key: 'status', header: 'Trạng thái', render: (item) => <span><StatusBadge family="adjustment" status={item.status} />{item.decisionReason && <><br /><span className={styles.muted}>{item.decisionReason}</span></>}</span> },
        ...(headTrainer ? [{ key: 'actions', header: 'Quyết định', render: (item: AdjustmentRequest) => item.status === 'PENDING'
          ? <div className={styles.row}><Button size="sm" onClick={() => setDecision({ item, approve: true })}>Duyệt</Button><Button size="sm" variant="secondary" onClick={() => setDecision({ item, approve: false })}>Từ chối</Button></div>
          : <div className={styles.stack}><span>{item.reviewedBy ? `${item.reviewedBy.fullName}, ${dateTime(item.reviewedAt ?? undefined)}` : 'Đã quyết định'}</span>
            {item.status === 'APPROVED' && <Button size="sm" variant="secondary" onClick={() => { setApplied(null); setApplying(item); }}>Áp dụng vào giai đoạn</Button>}</div> }] : []),
      ]} />
      <div className={styles.row}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {data.page + 1}/{Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Sau</Button></div>
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
    if (!approve && !reason.trim()) { setError('Hãy nêu lý do từ chối cho Trainer.'); return; }
    setBusy(true); setError('');
    try { await (approve ? api.approve(item.id, reason.trim()) : api.reject(item.id, reason.trim())); onDone(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  const title = approve ? 'Duyệt yêu cầu điều chỉnh' : 'Từ chối yêu cầu điều chỉnh';
  return <Modal open title={title} dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form="adjustment-decision-form" variant={approve ? 'primary' : 'destructive'} disabled={busy}>{busy ? 'Đang lưu…' : approve ? 'Duyệt' : 'Từ chối'}</Button></>}>
    <form id="adjustment-decision-form" onSubmit={submit} className={styles.stack}>
      <p><strong>{typeLabel(item.requestType)}</strong>: {item.requestedValue}</p>
      <p className={styles.muted}>Lý do: {item.reason}</p>
      {approve && <AlertBanner type="info" title="Phê duyệt chỉ ghi nhận quyết định">Trainer sẽ được thông báo. Sau đó dùng “Áp dụng vào giai đoạn” trên yêu cầu đã duyệt để thay đổi chương trình.</AlertBanner>}
      <TextAreaField label={approve ? 'Ghi chú quyết định (không bắt buộc)' : 'Lý do từ chối'} required={!approve} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {error && <AlertBanner type="danger" title="Chưa lưu được quyết định">{error}</AlertBanner>}
    </form>
  </Modal>;
}
