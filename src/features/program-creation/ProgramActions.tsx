import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { AlertBanner, Button, CandidateCard, Checkbox, EmptyState, ErrorState, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { ADJUSTMENT_TYPES, createProgramManagementApi } from './programManagementApi';
import type { ProgramDetail } from './programTypes';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

type StatusTarget = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
const STATUS_ACTIONS: Record<ProgramDetail['status'], { to: StatusTarget; label: string }[]> = {
  ACTIVE: [{ to: 'PAUSED', label: 'Tạm dừng chương trình' }, { to: 'COMPLETED', label: 'Kết thúc chương trình' }],
  PAUSED: [{ to: 'ACTIVE', label: 'Tiếp tục chương trình' }, { to: 'COMPLETED', label: 'Kết thúc chương trình' }],
  COMPLETED: [],
};

/** Head Trainer program management (CORE-021): status transitions and Trainer reassignment. */
export function HeadTrainerProgramActions({ program, onChanged }: { program: ProgramDetail; onChanged: () => void }) {
  const [status, setStatus] = useState<{ to: StatusTarget; label: string } | null>(null);
  const [reassign, setReassign] = useState(false);
  return <>
    {STATUS_ACTIONS[program.status].map((action) => <Button key={action.to} variant="secondary" onClick={() => setStatus(action)}>{action.label}</Button>)}
    {program.status !== 'COMPLETED' && <Button variant="secondary" onClick={() => setReassign(true)}>Đổi Trainer</Button>}
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
  return <Modal open title={action.label} dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form="program-status-form" variant={action.to === 'COMPLETED' ? 'destructive' : 'primary'} disabled={busy}>{busy ? 'Đang lưu…' : action.label}</Button></>}>
    <form id="program-status-form" onSubmit={submit} className={styles.stack}>
      <p>{program.horse.name} · {program.name}: {viLabel(program.status)} → {action.to}</p>
      {action.to === 'COMPLETED' && <AlertBanner type="warning" title="Kết thúc là không thể hoàn tác">Chương trình đã kết thúc không thể tiếp tục lại. Lịch sử buổi tập và đánh giá vẫn giữ nguyên.</AlertBanner>}
      <TextAreaField label="Lý do (không bắt buộc)" maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {error && <AlertBanner type="danger" title="Chưa đổi được trạng thái">{error}</AlertBanner>}
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
    if (!selected) { setError('Hãy chọn Trainer.'); return; }
    if (!effectiveFrom) { setError('Chọn ngày Trainer mới bắt đầu phụ trách.'); return; }
    if (selected.warnings.length > 0 && !acknowledged) { setError('Hãy xác nhận các cảnh báo về Trainer trước khi đổi.'); return; }
    setBusy(true); setError('');
    try { await api.reassignTrainer(program.id, { trainerUserId: selected.user.id, effectiveFrom, reason: reason.trim() || undefined, warningsAcknowledged: acknowledged }); onDone(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open size="lg" title="Đổi Trainer" dismissible={!busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form="program-reassign-form" disabled={busy || !selected}>{busy ? 'Đang lưu…' : 'Đổi Trainer'}</Button></>}>
    <form id="program-reassign-form" onSubmit={submit} className={styles.stack}>
      <p>Trainer hiện tại: {program.currentTrainer?.fullName ?? 'Chưa cung cấp'}. Phân công mới phải bắt đầu sau phân công hiện tại.</p>
      {candidates.pending && <LoadingState label="Đang tải danh sách Trainer phù hợp…" />}
      {candidates.error && <ErrorState title="Không tải được danh sách ứng viên" description={candidates.error} onRetry={candidates.reload} />}
      {candidates.data && (options.length === 0 ? <EmptyState title="Không có Trainer nào khác đang hoạt động" description={candidates.data.emptyReason ?? 'Chỉ có Trainer hiện tại đang hoạt động.'} /> : options.map((candidate) => <CandidateCard key={candidate.user.id}
        name={candidate.user.fullName} subtitle={`Trainer${candidate.experienceLevel ? ` · ${candidate.experienceLevel}` : ''}`}
        tags={candidate.skills} facts={[{ label: 'Mức phù hợp', value: viLabel(candidate.label) }, { label: 'Lý do', value: candidate.reasons.join(' · ') || 'Chưa cung cấp' },
          ...(candidate.warnings.length ? [{ label: 'Cảnh báo', value: candidate.warnings.join(' · ') }] : []), ...(candidate.hardBlock ? [{ label: 'Bị chặn', value: candidate.hardBlock }] : [])]}
        className={trainerId === candidate.user.id ? styles.selected : undefined}
        actions={<Button type="button" variant="secondary" aria-pressed={trainerId === candidate.user.id} disabled={busy || Boolean(candidate.hardBlock)} onClick={() => { setTrainerId(candidate.user.id); setAcknowledged(false); }}>
          {trainerId === candidate.user.id ? `Đã chọn ${candidate.user.fullName}` : `Chọn ${candidate.user.fullName}`}</Button>} />))}
      <TextField label="Trainer mới phụ trách từ ngày" type="date" required value={effectiveFrom} disabled={busy} onChange={(event) => setEffectiveFrom(event.target.value)} />
      <TextAreaField label="Lý do đổi Trainer (không bắt buộc)" maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {selected && selected.warnings.length > 0 && <Checkbox label="Tôi đã đọc các cảnh báo về Trainer" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} />}
      {error && <AlertBanner type="danger" title="Chưa đổi được Trainer">{error}</AlertBanner>}
    </form>
  </Modal>;
}

/** Trainer strategic change request (DEC-005, CORE-040): PENDING until the Head Trainer decides. */
export function TrainerAdjustmentAction({ program, onSubmitted }: { program: ProgramDetail; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false), [done, setDone] = useState(false);
  return <>
    <Button variant="secondary" disabled={program.status === 'COMPLETED'} onClick={() => { setDone(false); setOpen(true); }}>Đề xuất điều chỉnh chương trình</Button>
    {done && <span role="status">Đã gửi yêu cầu điều chỉnh tới Head Trainer.</span>}
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
    if (!type || !requested.trim() || !reason.trim()) { setError('Chọn loại thay đổi, mô tả nội dung đề xuất và lý do.'); return; }
    setBusy(true); setError('');
    try {
      await api.requestAdjustment(program.id, { requestType: type, horseProgramPhaseId: phaseId ? Number(phaseId) : undefined, currentValue: current.trim() || undefined,
        requestedValue: requested.trim(), reason: reason.trim(), evidenceNotes: evidence.trim() || undefined });
      onDone();
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open size="lg" title="Đề xuất điều chỉnh chương trình" dismissible={!busy && !dirty} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form="program-adjustment-form" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</Button></>}>
    <form id="program-adjustment-form" onSubmit={submit} className={styles.stack}>
      <AlertBanner type="info" title="Thay đổi chiến lược cần Head Trainer phê duyệt">Thay đổi ở cấp buổi tập (bài tập, quãng đường, thời lượng, ngày giờ, Work Rider) thực hiện khi lên lịch buổi tập. Yêu cầu này không thay đổi chương trình cho đến khi Head Trainer quyết định.</AlertBanner>
      <SelectField label="Loại thay đổi" required placeholder="Chọn loại thay đổi" options={ADJUSTMENT_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={type} disabled={busy} onChange={(event) => setType(event.target.value)} />
      <SelectField label="Giai đoạn (không bắt buộc)" placeholder="Toàn bộ chương trình" options={[...program.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase) => ({ value: String(phase.id), label: `${phase.phaseOrder}. ${phase.name}` }))} value={phaseId} disabled={busy} onChange={(event) => setPhaseId(event.target.value)} />
      <TextAreaField label="Giá trị hiện tại (không bắt buộc)" maxLength={1000} value={current} disabled={busy} onChange={(event) => setCurrent(event.target.value)} />
      <TextAreaField label="Nội dung đề xuất" required maxLength={1000} value={requested} disabled={busy} onChange={(event) => setRequested(event.target.value)} />
      <TextAreaField label="Lý do" required maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <TextAreaField label="Căn cứ (không bắt buộc)" maxLength={2000} value={evidence} disabled={busy} onChange={(event) => setEvidence(event.target.value)} />
      {error && <AlertBanner type="danger" title="Chưa gửi được yêu cầu">{error}</AlertBanner>}
    </form>
  </Modal>;
}
