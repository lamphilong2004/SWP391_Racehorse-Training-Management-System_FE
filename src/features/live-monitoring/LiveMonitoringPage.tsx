import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, ChartContainer, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, StatusBadge, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { dateTime, metric, type SessionResultView } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, jsonBody, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createSessionApi, type TrainingSession } from '../trainer-session/sessionApi';
import { connectSessionStream, type StreamStatus } from './sessionStream';

const STATUS_TEXT: Record<StreamStatus, string> = { Connecting: 'Đang kết nối', Connected: 'Đã kết nối', Disconnected: 'Mất kết nối', Unavailable: 'Không có kết nối' };
import { AlertDetail, type MonitoringAlertView } from './AlertDetail';
import { ReduceIntensity } from '../trainer-session/ReduceIntensity';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

type Sample = NonNullable<SessionResultView['samples']>[number];
type Alert = SessionResultView['alerts'][number] & { simulated?: boolean };
export function LiveMonitoringPage() {
  const [params, setParams] = useSearchParams(), [selected, setSelected] = useState(params.get('sessionId') ?? '');
  const sessionId = params.get('sessionId');
  // Same role resolution as the session view, so Head Trainer / Vet / Club Manager keep their own navigation.
  const { user } = useAuth();
  const role = user?.roles.find((value) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'].includes(value)) ?? 'TRAINER';
  return sessionId ? <LiveSession key={sessionId} rawId={sessionId} /> : <FlowShell title="Giám sát trực tiếp" section="Training" role={role}><form className={styles.row} onSubmit={(event) => { event.preventDefault(); if (Number.isSafeInteger(Number(selected)) && Number(selected) > 0) setParams({ sessionId: selected }); }}><TextField label="Mã buổi tập" required type="number" min="1" value={selected} onChange={(event) => setSelected(event.target.value)} /><Button type="submit">Mở buổi tập</Button></form><EmptyState title="Chọn buổi tập để giám sát" description="Mở giám sát trực tiếp từ chi tiết buổi tập hoặc nhập mã buổi tập." /><ButtonLink to="/training/calendar">Mở lịch tập</ButtonLink></FlowShell>;
}
function LiveSession({ rawId }: { rawId: string }) {
  const request = useFlowRequest(), { user } = useAuth(), api = useMemo(() => createSessionApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => {
    const sessionId = idOf(rawId);
    const [session, result] = await Promise.all([api.read(sessionId, signal), api.result(sessionId, signal)]);
    return { session, result };
  }, [api, rawId]);
  const resource = useResource(load);
  const loadThresholds = useCallback((signal: AbortSignal) => resource.data && user?.roles.some((role) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN'].includes(role)) ? request<{ metricType: string; thresholdValue: number; scope: string }[]>(`/api/horses/${resource.data.session.horse.id}/medical-thresholds`, { signal }) : Promise.resolve(null), [request, resource.data, user?.roles]);
  const thresholds = useResource(loadThresholds);
  const threshold = thresholds.data?.find((item) => item.metricType === 'HEART_RATE' && Number.isFinite(item.thresholdValue) && item.thresholdValue > 0);
  const [overlay, setOverlay] = useState<{ source?: typeof resource.data; sample?: Sample; state?: 'NORMAL' | 'WARNING' | 'CRITICAL'; samples: Sample[]; alerts: Alert[]; warning?: MonitoringAlertView; simulated?: boolean; session?: Partial<TrainingSession> }>({ samples: [], alerts: [] });
  const [connection, setConnection] = useState<{ source?: typeof resource.data; status: StreamStatus; message?: string }>({ status: 'Disconnected' });
  const [selectedAlert, setSelectedAlert] = useState<number | 'warning'>();
  const [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false), [reason, setReason] = useState(''); const pending = useRef(false);
  useEffect(() => {
    const source = resource.data; if (!source) return;
    const token = authSession.read()?.accessToken;
    if (!token) return;
    try {
      return connectSessionStream({ sessionId: idOf(rawId), token,
        onStatus: (status, message) => setConnection({ source, status, message }),
        onEvent: ({ topic, data }) => {
          if (topic === 'metrics' && typeof data.recordedAt === 'string' && ['MANUAL', 'SIMULATOR'].includes(String(data.source))) {
            const validMetric = (value: unknown) => value == null || (typeof value === 'number' && Number.isFinite(value));
            if (![data.heartRate, data.speedKmh, data.distanceM].every(validMetric)) return;
            const sample: Sample = { recordedAt: data.recordedAt, source: data.source as Sample['source'], heartRate: data.heartRate as number | null, speedKmh: data.speedKmh as number | null, distanceM: data.distanceM as number | null };
            if (!Number.isFinite(Date.parse(sample.recordedAt))) return;
            setOverlay((previous) => {
              const prior = previous.source === source ? previous : { source, samples: [], alerts: [] };
              if (prior.sample && Date.parse(sample.recordedAt) <= Date.parse(prior.sample.recordedAt)) return prior;
              return { ...prior, source, sample, simulated: prior.simulated || data.simulated === true, samples: [...prior.samples, sample].slice(-300), state: ['NORMAL', 'WARNING', 'CRITICAL'].includes(String(data.realtimeState)) ? data.realtimeState as 'NORMAL' | 'WARNING' | 'CRITICAL' : prior.state };
            });
          } else if (topic === 'state' && ['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED'].includes(String(data.status))) {
            setOverlay((previous) => ({ ...(previous.source === source ? previous : { samples: [], alerts: [] }), source, session: { status: data.status as TrainingSession['status'], ...(typeof data.blocked === 'boolean' ? { blocked: data.blocked } : {}), ...(typeof data.interruptionReason === 'string' ? { interruptionReason: data.interruptionReason } : {}) } }));
          } else if (topic === 'alerts' && data.type === 'WARNING' && (data.severity === undefined || data.severity === 'WARNING')) {
            setOverlay((previous) => ({ ...(previous.source === source ? previous : { samples: [], alerts: [] }), source, state: 'WARNING', warning: { sessionId: idOf(rawId), severity: 'WARNING', metric: typeof data.metric === 'string' ? data.metric : undefined, metricValue: typeof data.metricValue === 'number' && Number.isFinite(data.metricValue) ? data.metricValue : undefined, thresholdApplied: typeof data.thresholdApplied === 'number' && Number.isFinite(data.thresholdApplied) ? data.thresholdApplied : undefined, raisedAt: typeof data.raisedAt === 'string' ? data.raisedAt : undefined, simulated: data.simulated === true }, simulated: previous.source === source && previous.simulated || data.simulated === true }));
           } else if (topic === 'alerts' && ['CRITICAL_RAISED', 'CRITICAL_ACKNOWLEDGED', 'CRITICAL_ESCALATED'].includes(String(data.type)) && Number.isSafeInteger(data.alertId) && Number(data.alertId) > 0 && (data.severity === undefined || data.severity === 'CRITICAL') && (data.metric === undefined || data.metric === 'HEART_RATE')) {
            setOverlay((previous) => {
              const prior = previous.source === source ? previous : { samples: [], alerts: [] };
              const existing = prior.alerts.find((item) => item.id === data.alertId) ?? source.result.alerts.find((item) => item.id === data.alertId);
              const alert: Alert = { ...existing, id: Number(data.alertId), sessionId: idOf(rawId), metric: 'HEART_RATE', severity: 'CRITICAL',
                metricValue: typeof data.metricValue === 'number' ? data.metricValue : existing?.metricValue ?? NaN,
                thresholdApplied: typeof data.thresholdApplied === 'number' ? data.thresholdApplied : existing?.thresholdApplied ?? NaN,
                raisedAt: typeof data.raisedAt === 'string' ? data.raisedAt : existing?.raisedAt ?? '',
                ...(typeof data.simulated === 'boolean' ? { simulated: data.simulated } : {}),
                ...(typeof data.acknowledgedAt === 'string' || data.acknowledgedAt === null ? { acknowledgedAt: data.acknowledgedAt } : {}),
                ...(data.acknowledgedBy === null || data.acknowledgedBy && typeof data.acknowledgedBy === 'object' && typeof (data.acknowledgedBy as Record<string, unknown>).fullName === 'string' ? { acknowledgedBy: data.acknowledgedBy as Alert['acknowledgedBy'] } : {}),
                ...(typeof data.actionTaken === 'string' || data.actionTaken === null ? { actionTaken: data.actionTaken } : {}),
                ...(typeof data.escalatedToVetAt === 'string' || data.escalatedToVetAt === null ? { escalatedToVetAt: data.escalatedToVetAt } : {}),
              };
              if (!Number.isFinite(alert.metricValue) || !Number.isFinite(alert.thresholdApplied) || !Number.isFinite(Date.parse(alert.raisedAt))) return prior;
              return { ...prior, source, simulated: prior.simulated || data.simulated === true, alerts: [...prior.alerts.filter((item) => item.id !== alert.id), alert], ...(data.type === 'CRITICAL_RAISED' ? { state: 'CRITICAL' as const } : {}) };
            });
          }
        },
      });
    } catch (error) { queueMicrotask(() => setConnection({ source, status: 'Unavailable', message: errorMessage(error) })); }
  }, [resource.data, rawId]);
  const current = overlay.source === resource.data ? overlay : undefined;
  const data = resource.data, session = data ? { ...data.session, ...current?.session } : undefined;
  const live = connection.source === data && connection.status === 'Connected';
  const samples = [...(data?.result.samples ?? []), ...(current?.samples ?? [])].filter((item, index, all) => all.findIndex((value) => value.recordedAt === item.recordedAt) === index).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)).slice(-300);
  const last = current?.sample ?? samples.at(-1);
  const simulated = current?.simulated || samples.some((item) => item.source === 'SIMULATOR') || data?.result.actual.simulated;
  const alerts = [...(data?.result.alerts ?? []).filter((item) => !current?.alerts.some((value) => value.id === item.id)), ...(current?.alerts ?? [])].sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
  const values = samples.map((item) => item.heartRate).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const max = Math.ceil(Math.max(1, threshold?.thresholdValue ?? 0, ...values) / 20) * 20, min = Math.max(0, Math.floor(Math.min(max, ...values) / 20) * 20 - 20);
  const canWrite = user?.roles.includes('TRAINER'), canAck = canWrite || user?.roles.includes('VETERINARIAN');
  async function action(kind: 'pause' | 'resume' | 'stop' | 'acknowledge', alertId?: number) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setActionError('');
    try {
      if (kind === 'stop' && !reason.trim()) throw new Error('Nhập lý do dừng buổi tập.');
      const path = kind === 'acknowledge' ? `/api/monitoring-alerts/${idOf(alertId)}/acknowledge` : `/api/training-sessions/${idOf(rawId)}/${kind}`;
      await request(path, (kind === 'pause' || kind === 'resume') ? { method: 'POST' } : jsonBody('POST', kind === 'acknowledge' ? { action: 'ACKNOWLEDGE' } : { reason: reason.trim(), medicallyRelevant: false }));
      resource.reload();
    } catch (error) { setActionError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  const role = user?.roles.find((value) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'].includes(value)) ?? 'TRAINER';
  return <FlowShell title={session ? `${session.horse.name} · ${session.horse.horseCode}` : 'Giám sát trực tiếp'} description={session ? `${session.sessionCode} · ${session.focus ?? session.phaseName} · Work Rider ${session.workRider?.fullName ?? 'Chưa phân công'}` : undefined} section="Live Monitoring" role={role} actions={<div className={styles.row}><span role="status">{live ? 'Đã kết nối' : connection.source === data ? STATUS_TEXT[connection.status] : 'Đang tải dữ liệu'}</span><Button variant="secondary" onClick={resource.reload}>Kết nối lại / tải lại</Button><ButtonLink to={`/training/session/${rawId}`}>Chi tiết buổi tập</ButtonLink></div>}>
    {resource.pending && <LoadingState label="Đang tải buổi tập và số đo đã ghi trước khi kết nối…" />}{resource.error && <ErrorState title="Không giám sát được" description={resource.error} onRetry={resource.reload} />}
    {actionError && <AlertBanner type="danger" title="Chưa xác nhận thao tác">{actionError}</AlertBanner>}
    {connection.source === data && connection.message && <AlertBanner type="warning" title="Không có dữ liệu trực tiếp">{connection.message}</AlertBanner>}
    {simulated && <AlertBanner type="simulated" title="DỮ LIỆU MÔ PHỎNG">Máy chủ đánh dấu số đo hoặc cảnh báo là mô phỏng. Đây không phải dữ liệu tập thật.</AlertBanner>}
    {session && <div className={styles.row}><StatusBadge family="session" status={session.status} /><StatusBadge family="availability" status={session.trainingAvailability} />{current?.state && <StatusBadge family="realtime" status={current.state} />}<span>{last ? `${live ? 'Số đo gần nhất' : 'Số đo đã ghi gần nhất'}: ${dateTime(last.recordedAt)} · ${last.source}` : 'Chưa nhận được dữ liệu đo.'}</span></div>}
    {current?.state && <AlertBanner type={current.state === 'CRITICAL' ? 'danger' : current.state === 'WARNING' ? 'warning' : 'success'} title={`${viLabel(current.state)} · phân loại từ máy chủ`}>{live ? 'Phân loại nhận từ máy chủ trực tiếp.' : 'Phân loại nhận gần nhất; kết nối trực tiếp đã ngắt.'}</AlertBanner>}
    <div className={styles.metrics}><MetricCard label="Nhịp tim" value={metric(last?.heartRate, 'bpm')} caption="Số đo gần nhất từ máy chủ" /><MetricCard label="Tốc độ" value={metric(last?.speedKmh, 'km/h')} caption="Số đo gần nhất từ máy chủ" /><MetricCard label="Quãng đường" value={metric(last?.distanceM, 'm')} caption="Quãng đường từ máy chủ" /><MetricCard label="Thời gian đã trôi qua" value={metric(data?.result.actual.durationMin, 'phút')} caption="Thời lượng ghi nhận từ máy chủ" /></div>
    <div className={styles.columns}><div className={styles.stack}><ChartContainer title="Nhịp tim — buổi tập này" seriesLabel="Nhịp tim (bpm)" values={values} yTicks={[max, (max + min) / 2, min]} threshold={threshold ? { value: threshold.thresholdValue, label: `Ngưỡng nghiêm trọng hiện tại ${threshold.thresholdValue} bpm` } : undefined} xLabels={samples.length ? [dateTime(samples[0].recordedAt), dateTime(samples[samples.length - 1].recordedAt)] : []} emptyTitle="Chưa có số đo nhịp tim" emptyDescription="Số đo đã ghi và số đo trực tiếp sẽ hiện ở đây khi có." /><Card title="Tiến độ buổi tập"><div className={styles.stack}>{session?.exercises?.map((item) => <div className={styles.row} key={item.id}><strong>{item.exerciseName}</strong><span>{metric(item.distanceM, 'm')} · {viLabel(item.intensity, 'Chưa xác định')}</span></div>)}{!session?.exercises?.length && <EmptyState title="Chưa có kế hoạch bài tập" />}<p className="text-caption">Hệ thống chưa có dữ liệu lượt hiện tại và mức hoàn thành bài tập, nên không suy ra tiến độ. Biểu đồ giữ 300 số đo gần nhất.</p></div></Card></div>
    <div className={styles.stack}><Card title="Cảnh báo"><div className={styles.stack}>{alerts.map((alert) => <AlertBanner key={alert.id} type="danger" title={`CRITICAL · ${metric(alert.metricValue, 'bpm')}`}><p>{dateTime(alert.raisedAt)} · Ngưỡng áp dụng {alert.thresholdApplied} bpm</p><Button variant="tertiary" onClick={() => { setActionError(''); setSelectedAlert(alert.id); }}>Xem cảnh báo {alert.id}</Button>{alert.acknowledgedAt ? <p>Đã xác nhận {dateTime(alert.acknowledgedAt)}</p> : canAck && <Button disabled={busy} variant="secondary" onClick={() => void action('acknowledge', alert.id)}>Xác nhận cảnh báo</Button>}</AlertBanner>)}{current?.warning && <AlertBanner type="warning" title="CẢNH BÁO · tạm thời"><Button variant="tertiary" onClick={() => { setActionError(''); setSelectedAlert('warning'); }}>Xem chi tiết cảnh báo</Button></AlertBanner>}{!alerts.length && <EmptyState title={data ? 'Không có cảnh báo nghiêm trọng' : 'Không có dữ liệu cảnh báo'} />}</div></Card><Card title="Ngưỡng"><div className={styles.stack}>{thresholds.error && <ErrorState title="Không tải được ngưỡng" description={thresholds.error} onRetry={thresholds.reload} />}<KeyValue label="Ngưỡng nghiêm trọng đang áp dụng" value={threshold ? `${threshold.thresholdValue} bpm · ${threshold.scope}` : 'Chưa cung cấp'} /><KeyValue label="Ngưỡng cảnh báo" value="Chưa cung cấp; không áp dụng công thức" /><p>Ngưỡng do Veterinarian thiết lập. Mỗi cảnh báo đã ghi giữ nguyên ngưỡng áp dụng tại thời điểm đó.</p></div></Card></div></div>
    {canWrite && session && ['IN_PROGRESS', 'PAUSED'].includes(session.status) && <Card title="Thao tác của Trainer"><div className={styles.stack}><ReduceIntensity api={api} session={session} onSaved={resource.reload} /><TextAreaField label="Lý do dừng" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /><div className={styles.row}><Button disabled={busy || session.status !== 'IN_PROGRESS'} variant="secondary" onClick={() => void action('pause')}>Tạm dừng buổi tập</Button><Button disabled={busy || session.status !== 'PAUSED' || session.blocked || session.trainingAvailability === 'LOCKED'} variant="secondary" onClick={() => void action('resume')}>Tiếp tục buổi tập</Button><Button disabled={busy || !reason.trim()} variant="destructive" onClick={() => void action('stop')}>Dừng buổi tập</Button></div></div></Card>}
    <AlertDetail alert={selectedAlert === 'warning' ? current?.warning : alerts.find((item) => item.id === selectedAlert)} horse={session ? `${session.horse.name} · ${session.horse.horseCode}` : undefined} canAcknowledge={!!canAck} busy={busy} error={actionError} onClose={() => setSelectedAlert(undefined)} onAcknowledge={(id) => void action('acknowledge', id)} />
  </FlowShell>;
}
