import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, Checkbox, EmptyState, KeyValue, Modal, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, value, when } from './data';
import { IssueDialog } from './dialogs';
import { isTerminal, startBlocks, type RiderSession } from './types';
import styles from './rider.module.css';
import { viLabel } from '../../shared/viLabels';

export function RiderAssignmentPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Không tìm thấy lượt cưỡi" /> : <Assignment key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function Assignment({ id, api }: { id: number; api: RiderApi }) {
  const state = useRiderSession(id, api);
  const { handleApiError } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const [confirmations, setConfirmations] = useState<boolean[]>(Array(6).fill(false));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [conflictAt, setConflictAt] = useState<number | null>(null); const [report, setReport] = useState(false); const [reported, setReported] = useState('');
  const startOpen = location.pathname.endsWith('/start');
  if (!state.session || state.error) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const gates = startBlocks(session);
  const feedback = state.result?.riderFeedback ?? null;
  async function start() {
    if (pending.current || conflict) return;
    const blocks = startBlocks(session);
    if (blocks.length || !confirmations.every(Boolean)) { setError(blocks.join(' ') || 'Hãy xác nhận đủ sáu mục sẵn sàng.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.start(id);
      if (response.id !== id || response.status !== 'IN_PROGRESS') throw new ApiError(200, 'INVALID_RESPONSE', 'Chưa xác nhận được việc bắt đầu. Hãy tải lại lịch phân công.');
      navigate(`/rider/sessions/${id}/active`);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <div className={styles.stack}><ButtonLink to="/rider/assignments">← Lịch cưỡi của tôi</ButtonLink><div className={styles.header}><div><h1 className={styles.heading}>{session.horse.name} · {session.horse.horseCode}</h1><p>{session.focus || session.phaseName} · {session.sessionCode} · {when(session.scheduledStart)}</p><StatusBadge family="session" status={session.status} /></div><div className={`${styles.actions} ${styles.riderActionBar}`}>{(session.status === 'IN_PROGRESS' || session.status === 'PAUSED') && <Button variant="secondary" onClick={() => setReport(true)}>Báo cáo vấn đề</Button>}{session.status === 'SCHEDULED' ? <Button disabled={gates.length > 0 || conflict} onClick={() => navigate(`/rider/assignments/${id}/start`)}>Sẵn sàng bắt đầu</Button> : session.status === 'IN_PROGRESS' || session.status === 'PAUSED' ? <ButtonLink to={`/rider/sessions/${id}/active`}>Mở buổi tập đang diễn ra</ButtonLink> : (session.hasRiderFeedback || state.result?.riderFeedback ? <ButtonLink to="/rider/history">Xem lịch sử cưỡi</ButtonLink> : <ButtonLink to={`/rider/sessions/${id}/feedback`}>Gửi phản hồi người cưỡi</ButtonLink>)}</div></div>
    {reported && <AlertBanner type="success" title={`Đã gửi vấn đề ${reported}`}>Hệ thống ghi nhận kết quả buổi tập. Hãy xem trạng thái mới trước khi tiếp tục.</AlertBanner>}
    {session.status === 'SCHEDULED' ? <AlertBanner type={gates.length ? 'warning' : 'success'} title={gates.length ? 'Buổi tập chưa sẵn sàng bắt đầu' : 'Sẵn sàng cưỡi'}>{gates.length ? gates.join(' ') : 'Groom đã kiểm tra trước buổi tập đạt. Hệ thống sẽ kiểm tra lại các điều kiện bắt đầu.'}</AlertBanner> : isTerminal(session.status) ? <AlertBanner type={session.status === 'INTERRUPTED' ? 'danger' : 'success'} title={session.status === 'INTERRUPTED' ? 'BỊ GIÁN ĐOẠN — chưa hoàn thành' : 'COMPLETED'}>{session.interruptionReason || (feedback ? 'Đã hoàn thành lượt cưỡi. Phản hồi của bạn đã được gửi.' : 'Đã hoàn thành lượt cưỡi. Hãy gửi phản hồi khi thuận tiện và an toàn.')}</AlertBanner> : null}
    <div className={styles.columns}><div className={styles.stack}>{isTerminal(session.status) && <YourRide state={state} />}{isTerminal(session.status) && <YourFeedback id={id} feedback={feedback} />}<Card title="Hướng dẫn tập"><p className={styles.muted}>Cưỡi theo kế hoạch của Trainer. Bạn không thể đổi bài tập, cường độ hay quãng đường.</p><Exercises session={session} /></Card></div><aside className={styles.stack}><Card title="Buổi tập"><div className={styles.smallStack}><KeyValue label="Ngày · giờ" value={when(session.scheduledStart)} /><KeyValue label="Mặt sân" value={session.surface ?? 'Chưa cung cấp'} /><KeyValue label="Trọng tâm buổi tập" value={session.focus ?? session.phaseName} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Chưa cung cấp'} /><KeyValue label="Work Rider" value={session.workRider.fullName} /><KeyValue label="Khả năng tập luyện" value={viLabel(session.trainingAvailability, 'Chưa cung cấp')} /></div></Card><Card title="Thông tin chương trình"><p>Chương trình #{session.programId} · {session.phaseName}</p><p className={styles.muted}>Chương trình, giai đoạn và khoảng cường độ do Head Trainer và Trainer đặt.</p></Card></aside></div>
    {startOpen && <Modal open title="Bắt đầu buổi tập này?" onClose={busy ? () => undefined : () => navigate(`/rider/assignments/${id}`)} footer={<><Button variant="secondary" disabled={busy} onClick={() => navigate(`/rider/assignments/${id}`)}>Chưa sẵn sàng — quay lại lịch phân công</Button><Button disabled={busy || conflict || gates.length > 0 || !confirmations.every(Boolean)} onClick={start}>{busy ? 'Đang bắt đầu…' : 'Bắt đầu buổi tập'}</Button></>}><div className={styles.smallStack}><p>{session.horse.name} · {session.sessionCode} · {session.surface ?? 'Chưa có mặt sân'}</p>{[`Đúng ngựa — ${session.horse.name}`, `Đúng buổi tập — ${session.sessionCode}`, `Mặt sân — ${session.surface ?? 'kiểm tra mặt sân được giao'}`, 'Yên cương và dụng cụ đã sẵn sàng', 'Ngựa đã ổn định và sẵn sàng tập', 'Đã đọc hướng dẫn tập'].map((label, index) => <Checkbox key={label} label={label} checked={confirmations[index]} disabled={busy} onChange={(event) => setConfirmations((old) => old.map((checked, position) => position === index ? event.target.checked : checked))} />)}<p className={styles.muted}>Đây là kiểm tra sẵn sàng của bạn — không phải xác nhận của thú y.</p><p>Lượt cưỡi chưa bắt đầu. Nếu chưa sẵn sàng, hãy nhờ Groom hoặc Trainer được phân công kiểm tra lại.</p>{gates.length > 0 && <AlertBanner type="warning" title="Bị chặn bắt đầu">{gates.join(' ')}</AlertBanner>}{error && <AlertBanner type="danger" title="Không bắt đầu được buổi tập">{error}</AlertBanner>}{conflict && <Button variant="secondary" onClick={() => { state.reload(); navigate(`/rider/assignments/${id}`); }}>Tải lại lịch phân công</Button>}</div></Modal>}
    {report && <IssueDialog session={session} api={api} onClose={() => { setReport(false); state.reload(); }} onSaved={(code) => { setReported(code); setReport(false); state.reload(); }} />}
  </div>;
}
/** Figma WR-D6 "Your ride": server-recorded values only; nothing is calculated here. */
function YourRide({ state }: { state: ReturnType<typeof useRiderSession> }) {
  return <Card title="Lượt cưỡi của bạn"><div className={styles.facts}><KeyValue label="Quãng đường" value={value(state.result?.actual.totalDistanceM, 'm')} /><KeyValue label="Thời lượng" value={value(state.result?.actual.durationMin, 'min')} /><KeyValue label="Nhịp tim cao nhất" value={value(state.result?.actual.maxHeartRate, 'bpm')} /></div>{Boolean(state.resultError) && <AlertBanner type="warning" title="Chưa có số liệu kết quả">{errorMessage(state.resultError)}</AlertBanner>}</Card>;
}
/** Figma WR-D6 "Your Rider Feedback" card. */
function YourFeedback({ id, feedback }: { id: number; feedback: NonNullable<ReturnType<typeof useRiderSession>['result']>['riderFeedback'] | null }) {
  const quote = feedback && [feedback.responses.horseResponse, feedback.responses.strideFeeling, feedback.responses.notes].find((text) => typeof text === 'string' && text.trim());
  return <Card title="Phản hồi của bạn" action={feedback ? <span className={styles.chip}>ĐÃ GỬI {new Date(feedback.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span> : undefined}>{feedback ? <div className={styles.smallStack}>{quote && <p>“{quote}”</p>}<p className={styles.muted}>Trainer của bạn sẽ thấy trong phần đánh giá buổi tập.</p></div> : <div className={styles.smallStack}><p className={styles.muted}>Chưa gửi.</p><ButtonLink to={`/rider/sessions/${id}/feedback`}>Gửi phản hồi người cưỡi</ButtonLink></div>}</Card>;
}
/** Figma WR-D2 (416:9756): numbered exercise cards with parameter chips; only supplied values are shown. */
export function Exercises({ session }: { session: RiderSession }) {
  const chips = (exercise: RiderSession['exercises'][number]) => [
    exercise.distanceM != null ? `${exercise.distanceM.toLocaleString('vi-VN')} m${exercise.repetitions != null ? ` × ${exercise.repetitions}` : ''}` : exercise.repetitions != null ? `${exercise.repetitions} lượt` : null,
    exercise.durationMin != null ? `${exercise.durationMin} phút` : null,
    exercise.restIntervalMin != null ? `Nghỉ ${exercise.restIntervalMin} phút` : 'Nghỉ —',
    exercise.intensity ? `Cường độ ${exercise.intensity}` : 'Chưa có cường độ',
    exercise.surface ?? session.surface ?? 'Chưa có mặt sân',
  ].filter((chip): chip is string => Boolean(chip));
  return <ol className={styles.exerciseList}>{[...session.exercises].sort((a, b) => a.exerciseOrder - b.exerciseOrder).map((exercise) => <li key={exercise.id} className={styles.exercise}>
    <span className={styles.exerciseNumber} aria-hidden="true">{exercise.exerciseOrder}</span>
    <div className={styles.smallStack}><h3 className={styles.exerciseName}>{exercise.exerciseName}</h3><div className={styles.badges}>{chips(exercise).map((chip) => <span key={chip} className={styles.paramChip}>{chip}</span>)}</div></div>
  </li>)}</ol>;
}
