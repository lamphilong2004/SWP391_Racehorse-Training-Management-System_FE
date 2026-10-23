import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, RadioGroup, StatusBadge, TextAreaField, UnsavedChangesGuard } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, when } from './data';
import { isTerminal, type RiderFeedbackInput } from './types';
import styles from './rider.module.css';
import { viLabel } from '../../shared/viLabels';

export function RiderFeedbackPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Không tìm thấy lượt cưỡi" /> : <Feedback key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function Feedback({ id, api }: { id: number; api: RiderApi }) {
  const state = useRiderSession(id, api); const { handleApiError } = useAuth();
  const [responses, setResponses] = useState<NonNullable<RiderFeedbackInput['responses']>>({});
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [saved, setSaved] = useState(false); const [conflictAt, setConflictAt] = useState<number | null>(null); const [error, setError] = useState('');
  if (!state.session || state.error) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const interrupted = session.status === 'INTERRUPTED';
  const existing = state.result?.riderFeedback;
  const locked = busy || saved || conflict || Boolean(existing) || Boolean(session.hasRiderFeedback);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || locked || !isTerminal(session.status)) return;
    if (Object.entries(responses).some(([key, text]) => text != null && text.length > (key === 'notes' || key === 'preInterruptionDescription' ? 1000 : 500))) { setError('Nội dung phản hồi vượt quá giới hạn cho phép.'); return; }
    const payload = { responses: Object.fromEntries(Object.entries(responses).filter(([key]) => interrupted || key !== 'preInterruptionDescription').map(([key, text]) => [key, text?.trim() || null])) };
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.feedback(id, payload);
      if (response.sessionId !== id || !Number.isSafeInteger(response.id) || response.id < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được phản hồi. Hãy tải lại trước khi thử lại.');
      setSaved(true);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const selected = existing?.responses ?? responses;
  // Feedback text stays in memory only; leaving before the server confirms it asks first.
  const dirty = !saved && !existing && !session.hasRiderFeedback && Object.values(responses).some((text) => Boolean(text?.trim()));
  function update(key: keyof RiderFeedbackInput['responses'], text: string) { setResponses((old) => ({ ...old, [key]: text })); }
  return <div className={styles.stack}><UnsavedChangesGuard dirty={dirty} /><Link className={styles.link} to={`/rider/assignments/${id}`}>← Lịch phân công</Link><h1 className={styles.heading}>Phản hồi của người cưỡi</h1><p className={styles.muted}>Hãy gửi khi an toàn — từ máy cạnh đường đua hoặc văn phòng.</p>{!isTerminal(session.status) ? <AlertBanner type="warning" title="Chưa thể gửi phản hồi">Hãy hoàn thành buổi tập hoặc chờ kết quả gián đoạn. Trạng thái hiện tại: {viLabel(session.status)}.</AlertBanner> : <div className={styles.columns}><Card><form onSubmit={submit} className={styles.stack}>
    <RadioGroup label={interrupted ? 'Phản ứng của ngựa trước khi dừng' : 'Ngựa phản ứng thế nào?'} value={selected.horseResponse ?? ''} onChange={(text) => update('horseResponse', text)} disabled={locked} options={['Strong', 'Normal', 'Sluggish'].map((text) => ({ value: text, label: viLabel(text) }))} />
    <RadioGroup label={interrupted ? 'Thăng bằng và điều khiển trước khi dừng' : 'Thăng bằng và điều khiển'} value={selected.balance ?? ''} onChange={(text) => update('balance', text)} disabled={locked} options={['Good', 'Some issues', 'Difficult'].map((text) => ({ value: text, label: viLabel(text) }))} />
    <TextAreaField label="Quan sát hô hấp" value={selected.breathing ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('breathing', event.target.value)} />
    <TextAreaField label="Cảm nhận sải bước" value={selected.strideFeeling ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('strideFeeling', event.target.value)} />
    <TextAreaField label="Có gì bất thường không?" value={selected.abnormalBehavior ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('abnormalBehavior', event.target.value)} />
    {interrupted && <TextAreaField label="Bạn thấy gì trước khi dừng?" value={selected.preInterruptionDescription ?? ''} disabled={locked} maxLength={1000} onChange={(event) => update('preInterruptionDescription', event.target.value)} />}
    <TextAreaField label="Ghi chú (không bắt buộc)" value={selected.notes ?? ''} disabled={locked} maxLength={1000} onChange={(event) => update('notes', event.target.value)} />
    <AlertBanner type="info" title={`Buổi tập giữ trạng thái ${viLabel(session.status)}`}>Gửi phản hồi không làm buổi tập bị gián đoạn thành hoàn thành. Trainer sẽ xem phản hồi của bạn.</AlertBanner>
    {(saved || existing || session.hasRiderFeedback) && <AlertBanner type="success" title="Đã gửi phản hồi">{existing ? `Đã gửi lúc ${when(existing.submittedAt)}.` : 'Mỗi lượt cưỡi chỉ được gửi phản hồi một lần.'}</AlertBanner>}
    {error && <AlertBanner type="danger" title="Chưa xác nhận được phản hồi">{error}</AlertBanner>}
    {conflict ? <Button variant="secondary" onClick={state.reload}>Tải lại phản hồi</Button> : !saved && !existing && !session.hasRiderFeedback ? <Button type="submit" disabled={locked}>{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</Button> : null}
    </form></Card><Card title={`${session.horse.name} · ${session.focus || session.phaseName}`}><p>{session.sessionCode} · {when(session.scheduledStart)}</p><StatusBadge family="session" status={session.status} /><p>Trainer {session.trainer?.fullName ?? 'Chưa cung cấp'} · Người cưỡi {session.workRider.fullName}</p>{interrupted && <p>{session.interruptionReason || 'Không có lý do gián đoạn.'}</p>}{Boolean(state.resultError) && <AlertBanner type="warning" title="Không tải được phản hồi">{errorMessage(state.resultError)} Hệ thống vẫn chỉ cho gửi một lần mỗi buổi tập.</AlertBanner>}<Link className={styles.link} to="/rider/history">Xem lịch sử cưỡi</Link></Card></div>}</div>;
}
