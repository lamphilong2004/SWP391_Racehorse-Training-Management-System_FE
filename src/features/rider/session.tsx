import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, EmptyState, KeyValue, MetricCard, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { Exercises } from './assignment';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, value } from './data';
import { IssueDialog, MetricDialog } from './dialogs';
import { isTerminal } from './types';
import styles from './rider.module.css';

export function RiderSessionPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Không tìm thấy lượt cưỡi" /> : <ActiveSession key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function ActiveSession({ id, api }: { id: number; api: RiderApi }) {
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [conflictAt, setConflictAt] = useState<number | null>(null);
  const state = useRiderSession(id, api, !busy);
  const { handleApiError } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'issue' | 'metric' | null>(null);
  if (!state.session || (state.error instanceof ApiError && (state.error.status === 403 || state.error.status === 404))) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const terminal = isTerminal(session.status);
  const sample = state.result?.samples?.at(-1);
  const stale = Boolean(state.error);
  async function complete() {
    if (pending.current || conflict || stale || session.status !== 'IN_PROGRESS') return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.complete(id);
      if (response.id !== id || response.status !== 'COMPLETED') throw new ApiError(200, 'INVALID_RESPONSE', 'Chưa xác nhận được việc hoàn thành. Hãy tải lại lượt cưỡi.');
      navigate(`/rider/sessions/${id}/feedback`);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  function close() { setDialog(null); state.reload(); }
  return <div className={styles.stack}><ButtonLink to={`/rider/assignments/${id}`}>← Lịch phân công</ButtonLink><div className={styles.header}><div><h1 className={styles.heading}>Buổi tập đang diễn ra</h1><p>{session.horse.name} · {session.sessionCode} · {session.surface ?? 'Chưa có mặt sân'}</p><p className={styles.muted}>Màn hình dùng cạnh đường đua / văn phòng. Không thao tác khi đang cưỡi.</p></div><div className={`${styles.actions} ${styles.riderActionBar}`}>{!terminal && session.status !== 'SCHEDULED' && <><Button variant="secondary" disabled={busy || stale} onClick={() => setDialog('issue')}>Báo cáo vấn đề</Button><Button variant="secondary" disabled={busy || stale} onClick={() => setDialog('metric')}>Thêm số đo</Button></>}{session.status === 'IN_PROGRESS' && <Button disabled={busy || stale || conflict} onClick={complete}>{busy ? 'Đang kết thúc…' : 'Kết thúc buổi tập'}</Button>}{terminal && <ButtonLink to={`/rider/sessions/${id}/feedback`}>{session.hasRiderFeedback ? 'Xem phản hồi người cưỡi' : 'Gửi phản hồi người cưỡi'}</ButtonLink>}<Button variant="secondary" disabled={busy} onClick={state.reload}>Làm mới lượt cưỡi</Button></div></div>
    <div className={`${styles.state} ${styles.stateRow} ${session.status === 'PAUSED' ? styles.paused : session.status === 'INTERRUPTED' ? styles.interrupted : ''}`}><div><h2>{session.status === 'PAUSED' ? 'SESSION PAUSED — BY YOUR TRAINER' : session.status === 'INTERRUPTED' ? 'SESSION INTERRUPTED — NOT COMPLETED' : session.status.replaceAll('_', ' ')}</h2><p>{session.status === 'PAUSED' ? 'Cho ngựa đi bộ an toàn và chờ. Chỉ Trainer mới được tiếp tục buổi tập.' : session.interruptionReason || 'Làm theo hướng dẫn tập được giao.'}{session.actualStart && Number.isFinite(Date.parse(session.actualStart)) ? ` · Bắt đầu ${new Date(session.actualStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : ''}</p></div>{!terminal && session.actualStart && <Elapsed start={session.actualStart} />}</div>
    <p className={styles.muted}>Đồng bộ mỗi 5 giây · {state.syncedAt ? `Cập nhật lúc ${new Date(state.syncedAt).toLocaleTimeString('vi-VN')}` : 'Đang chờ đồng bộ'}. Màn hình này không dùng kết nối trực tiếp.</p>
    {stale && <AlertBanner type="danger" title="Mất đồng bộ — trạng thái hiển thị có thể đã cũ">{errorMessage(state.error)} Các thao tác bị khóa cho đến khi làm mới thành công.</AlertBanner>}
    {Boolean(state.resultError) && <AlertBanner type="warning" title="Chưa có số liệu">{errorMessage(state.resultError)} Số liệu sẽ hiện khi máy chủ cung cấp.</AlertBanner>}
    {notice && <AlertBanner type="success" title={notice} />}{error && <AlertBanner type="danger" title="Chưa xác nhận được thao tác">{error}</AlertBanner>}
    {state.result?.actual.simulated && <AlertBanner type="warning" title="DỮ LIỆU MÔ PHỎNG — Nguồn: trình mô phỏng">Các số đo này đến từ trình mô phỏng, không phải số đo tập thật.</AlertBanner>}
    <div className={styles.metrics}><MetricCard label="Thời lượng" value={value(state.result?.actual.durationMin, 'phút')} /><MetricCard label="Quãng đường đã ghi" value={value(state.result?.actual.totalDistanceM, 'm')} /><MetricCard label="Tốc độ gần nhất" value={value(sample?.speedKmh, 'km/h')} /><MetricCard label="Nhịp tim gần nhất" value={value(sample?.heartRate, 'bpm')} /></div>
    <div className={styles.columns}><Card title="Thứ tự bài tập được giao"><Exercises session={session} /><p className={styles.muted}>Hệ thống chưa cung cấp tiến độ bài tập / lượt hiện tại; không suy ra tiến độ từ số đo.</p></Card><aside className={styles.stack}><Card title="Điều khiển của Trainer"><p>Tạm dừng, Tiếp tục và Dừng là thao tác của Trainer trong Giám sát trực tiếp, không phải của Work Rider.</p><p className={styles.muted}>Màn hình tự làm mới theo trạng thái từ máy chủ.</p></Card><Card title="Buổi tập đã ghi"><div className={styles.smallStack}><StatusBadge family="session" status={session.status} /><KeyValue label="Bắt đầu thực tế" value={session.actualStart ?? 'Chưa cung cấp'} /><KeyValue label="Kết thúc thực tế" value={session.actualEnd ?? 'Chưa cung cấp'} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Chưa cung cấp'} /></div></Card></aside></div>
    {dialog === 'issue' && <IssueDialog session={session} api={api} onClose={close} onSaved={(code) => { setNotice(`Đã gửi vấn đề ${code}`); close(); }} />}
    {dialog === 'metric' && <MetricDialog session={session} api={api} onClose={close} onSaved={() => { setNotice('Đã ghi số đo thủ công'); close(); }} />}
  </div>;
}

/** Figma WR-D3 elapsed clock: wall-clock time since the server's actualStart; not a training measurement. */
function Elapsed({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(start)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <div className={styles.elapsed}><span>Đã trôi qua</span><strong>{text}</strong></div>;
}
