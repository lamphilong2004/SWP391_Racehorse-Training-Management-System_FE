import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, ChartContainer, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, Modal, StatusBadge, Tabs, UnsavedChangesGuard } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import { evaluationApi, type EvaluationApi } from './api';
import { EvaluationForm } from './EvaluationForm';
import { PerformanceHistory } from './PerformanceHistory';
import { clockTime, dateTime, isTerminal, metric, RESULT_LABELS, type SessionResultView } from './models';
import './evaluation.css';
import { viLabel } from '../../shared/viLabels';

/** Roles routed to /training/session/:id (see router). */
const SESSION_DETAIL_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'];

const READ_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'WORK_RIDER', 'CLUB_MANAGER', 'VETERINARIAN'];
const HISTORY_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN'];
const display = (value: string | null | undefined) => value || 'Chưa ghi nhận';

export function SessionEvaluationPage({ api = evaluationApi }: { api?: EvaluationApi }) {
  const { id = '' } = useParams();
  const auth = useAuth();
  const sessionId = Number(id);
  const role = READ_ROLES.find((candidate) => auth.user?.roles.includes(candidate));
  if (!auth.user) return null; // RequireAuth owns restore/sign-in/error navigation.
  if (!role) return <AlertBanner type="danger" title="Không có quyền truy cập" children="Vai trò của bạn không được xem kết quả buổi tập." />;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(sessionId) || sessionId < 1) return <EmptyState title="Không tìm thấy buổi tập" description="Hãy dùng mã buổi tập hợp lệ." />;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role }} breadcrumb={[{ label: 'Huấn luyện' }, { label: 'Đánh giá buổi tập' }]}>
    <EvaluationContent key={`${auth.user.id}:${sessionId}`} sessionId={sessionId} api={api} />
  </AppShell>;
}

function EvaluationContent({ sessionId, api }: { sessionId: number; api: EvaluationApi }) {
  const { user, handleApiError } = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('view') ?? 'result';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: SessionResultView; error?: unknown }>({});
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.result(sessionId, controller.signal).then((data) => {
      if (!active) return;
      if (data.session.id !== sessionId) throw new ApiError(200, 'INVALID_RESPONSE', 'Máy chủ trả về một buổi tập khác.');
      setState({ data });
    }).catch((error: unknown) => { if (active && !handleApiError(error)) setState({ error }); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, api, attempt, handleApiError]);
  const reload = () => {
    if (submitting) return;
    setConfirmReload(false); setDirty(false); setSaved(false);
    setState({}); setAttempt((previous) => previous + 1);
  };
  const requestReload = () => {
    if (submitting) return;
    if (dirty && !saved) setConfirmReload(true);
    else reload();
  };
  if (state.error) {
    const error = state.error;
    if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Không có quyền truy cập" children="Buổi tập này nằm ngoài phạm vi được phép của bạn. Phiên đăng nhập vẫn còn hiệu lực." />;
    if (error instanceof ApiError && error.status === 404) return <EmptyState title="Không tìm thấy buổi tập" />;
    return <ErrorState title="Không tải được kết quả buổi tập" description={error instanceof Error ? error.message : 'Không tải được buổi tập này.'} onRetry={reload} />;
  }
  if (!state.data) return <LoadingState label="Đang tải kết quả buổi tập…" />;
  const data = state.data;
  const { session, actual } = data;
  const canEvaluate = user?.roles.includes('TRAINER') && isTerminal(session.status);
  const canHistory = HISTORY_ROLES.some((role) => user?.roles.includes(role));
  const changeTab = (view: string) => setSearch((previous) => { const next = new URLSearchParams(previous); next.set('view', view); return next; });
  const selected = ['result', 'comparison', 'evaluation'].includes(tab) ? tab : 'result';
  return <div className="evaluation-stack">
    <UnsavedChangesGuard dirty={dirty && !saved} allowSameRoute />
    <div className="evaluation-actions"><div className="evaluation-stack-sm"><h1 className="text-h1">Đánh giá buổi tập · {session.focus || session.sessionCode}</h1><p>{session.horse.name} · {session.horse.horseCode} · {session.sessionCode}</p></div><StatusBadge family="session" status={session.status} />
      {SESSION_DETAIL_ROLES.some((role) => user?.roles.includes(role)) && <Link className="evaluation-link-button" to={`/training/session/${session.id}`}>Chi tiết buổi tập</Link>}
      {canHistory && <Button variant="secondary" disabled={submitting} onClick={() => changeTab(tab === 'history' ? 'result' : 'history')}>{tab === 'history' ? 'Quay lại đánh giá' : 'Lịch sử thành tích'}</Button>}
      <Button variant="secondary" disabled={submitting} onClick={requestReload}>Tải lại buổi tập</Button>
    </div>
    <Modal open={confirmReload} title="Hủy thay đổi đánh giá?" onClose={() => setConfirmReload(false)}
      footer={<><Button variant="secondary" autoFocus onClick={() => setConfirmReload(false)}>Tiếp tục chỉnh sửa</Button>
        <Button variant="danger" disabled={submitting} onClick={reload}>Hủy và tải lại</Button></>}>
      <p>Đánh giá của bạn chưa được lưu. Tải lại sẽ xóa nội dung đã nhập và lấy dữ liệu buổi tập mới nhất từ máy chủ.</p>
    </Modal>
    {session.status === 'INTERRUPTED' ? <AlertBanner type="danger" title="BỊ GIÁN ĐOẠN — có thể đánh giá, chưa hoàn thành" children={`${session.interruptionReason || 'Buổi tập đã bị dừng.'} Lưu đánh giá vẫn giữ trạng thái Bị gián đoạn.`} /> : session.status === 'COMPLETED' ? <AlertBanner type="success" title="ĐÃ HOÀN THÀNH — xem lại kết quả đã ghi" children="Ghi đánh giá và khuyến nghị cho buổi tập đã thực hiện này." /> : <AlertBanner type="warning" title="Chưa thể đánh giá" children="Chỉ đánh giá được buổi tập Đã hoàn thành hoặc Bị gián đoạn." />}
    <Card><div className="evaluation-facts"><KeyValue label="Giờ bắt đầu dự kiến" value={dateTime(session.scheduledStart)} /><KeyValue label="Giờ kết thúc dự kiến" value={dateTime(session.scheduledEnd)} /><KeyValue label="Trọng tâm buổi tập" value={display(session.focus)} /><KeyValue label="Mặt sân" value={display(session.surface)} /><KeyValue label="Trainer" value={display(session.trainer?.fullName)} /><KeyValue label="Work Rider" value={session.workRider.fullName} /><KeyValue label="Chương trình / Giai đoạn" value={`Chương trình ${session.programId} · ${session.phaseName}`} /></div><p className="text-caption">Đánh giá này chỉ áp dụng cho buổi tập đã thực hiện, không thay đổi chiến lược chương trình hay mẫu gốc.</p></Card>
    {tab === 'history' && (canHistory ? <PerformanceHistory key={session.horse.id} horseId={session.horse.id} api={api} onError={handleApiError} /> : <AlertBanner type="danger" title="Không có quyền truy cập" children="Vai trò của bạn không được xem lịch sử thành tích của ngựa." />)}
    {/* Kept mounted while History is shown so an unsaved evaluation draft is not lost (UX Playbook v2.1 §1.1). */}
    <div className="evaluation-stack" hidden={tab === 'history'}>
      <Tabs label="Đánh giá buổi tập" idPrefix="evaluation" value={selected} onChange={changeTab} items={[{ value: 'result', label: 'Kết quả' }, { value: 'comparison', label: 'Kế hoạch so với thực tế' }, { value: 'evaluation', label: 'Đánh giá & khuyến nghị' }]} />
      {selected !== 'evaluation' && <div role="tabpanel" id={`evaluation-panel-${selected}`} aria-labelledby={`evaluation-tab-${selected}`}>
        {selected === 'result' ? <ResultPanel data={data} /> : <ComparisonPanel data={data} />}
      </div>}
      <div role="tabpanel" id="evaluation-panel-evaluation" aria-labelledby="evaluation-tab-evaluation" hidden={selected !== 'evaluation'}>
          <div className="evaluation-columns"><div className="evaluation-stack">
            {saved && <AlertBanner type="success" title="Đã lưu đánh giá" children={`Trạng thái buổi tập vẫn là ${viLabel(session.status)}.`} />}
            {data.evaluation ? <Card title="Đánh giá đã ghi"><div className="evaluation-stack"><p>{RESULT_LABELS[data.evaluation.result]}</p><KeyValue label="Tóm tắt" value={display(data.evaluation.evaluatedSummary)} /><KeyValue label="Ghi chú chuyên môn" value={display(data.evaluation.evaluationNotes)} /><KeyValue label="Khuyến nghị" value={display(data.evaluation.recommendation)} /><p className="text-caption">{data.evaluation.evaluatedBy.fullName} · {dateTime(data.evaluation.evaluatedAt)}</p></div></Card> : session.hasEvaluation ? <AlertBanner type="warning" title="Đã có đánh giá" children="Tải lại buổi tập để xem đánh giá đã ghi. Không được gửi lần thứ hai." /> : canEvaluate ?
              <EvaluationForm onPendingChange={setSubmitting} onDirtyChange={setDirty} interrupted={session.status === 'INTERRUPTED'} onSave={async (input) => {
                try {
                  const evaluation = await api.submit(sessionId, input);
                  if (evaluation.sessionId !== sessionId) throw new ApiError(201, 'INVALID_RESPONSE', 'Máy chủ trả về đánh giá của một buổi tập khác. Hãy tải lại trước khi thử lại.');
                  setState({ data: { ...data, evaluation } }); setSaved(true);
                } catch (error) { handleApiError(error); throw error; }
              }} /> : <AlertBanner type="warning" title="Kết quả chỉ xem" children="Chỉ Trainer được phân công mới được gửi đánh giá cho buổi tập đã kết thúc. Hệ thống kiểm soát phạm vi phân công." />}
          </div><aside className="evaluation-stack"><Card title="Cần thay đổi chiến lược?"><p>Mục tiêu chương trình, mẫu gốc, chiến lược giai đoạn và mức khối lượng đã duyệt cần Head Trainer phê duyệt. Khuyến nghị ở đây không thay đổi kế hoạch.</p></Card><FeedbackCard data={data} /></aside></div>
      </div>
    </div>
    {actual.simulated && <StatusBadge family="simulated" status="SIMULATED" />}
  </div>;
}

function FeedbackCard({ data }: { data: SessionResultView }) {
  const feedback = data.riderFeedback;
  const labels: Record<string, string> = { horseResponse: 'Phản ứng của ngựa', balance: 'Thăng bằng', breathing: 'Hô hấp', strideFeeling: 'Cảm nhận sải bước', abnormalBehavior: 'Hành vi bất thường', preInterruptionDescription: 'Trước khi gián đoạn', notes: 'Ghi chú' };
  return <Card title="Phản hồi của người cưỡi">{feedback ? <div className="evaluation-stack-sm"><p>Người gửi {feedback.submittedBy.fullName} · {dateTime(feedback.submittedAt)}</p>{Object.entries(feedback.responses).map(([key, value]) => value && <KeyValue key={key} label={labels[key] ?? key} value={viLabel(value)} />)}</div> : <EmptyState title="Chưa có phản hồi của người cưỡi" />}</Card>;
}

function ResultPanel({ data }: { data: SessionResultView }) {
  const { actual, session } = data;
  const samples = data.samples ?? [];
  const completeHeartSeries = samples.length > 0 && samples.every((sample) => typeof sample.heartRate === 'number' && Number.isFinite(sample.heartRate));
  const hearts = completeHeartSeries ? samples.map((sample) => sample.heartRate!) : [];
  const min = Math.floor(Math.min(...hearts, 100) / 20) * 20;
  const max = Math.ceil(Math.max(...hearts, 200) / 20) * 20;
  return <div className="evaluation-columns"><div className="evaluation-stack">
    <div className="evaluation-metrics"><MetricCard label="Quãng đường" value={metric(actual.totalDistanceM, 'm')} caption="Tổng hợp từ hệ thống" /><MetricCard label="Thời lượng" value={metric(actual.durationMin, 'phút')} /><MetricCard label="Nhịp tim cao nhất" value={metric(actual.maxHeartRate, 'bpm')} /><MetricCard label="Tốc độ tối đa" value={metric(actual.maxSpeedKmh, 'km/h')} /></div>
    <ChartContainer title="Nhịp tim — buổi tập đã ghi" seriesLabel="Nhịp tim (bpm), theo thứ tự đo" values={hearts} yTicks={[max, (max + min) / 2, min]} xLabels={hearts.length ? [...new Set([clockTime(samples[0].recordedAt), clockTime(samples.at(-1)!.recordedAt)])] : []} emptyTitle="Chưa có chuỗi nhịp tim đầy đủ" emptyDescription="Số đo bị thiếu không được tính là 0 hay nội suy. Các số đo hiện có được liệt kê bên dưới." />
    <Card title="Số đo đã ghi"><div className="evaluation-table"><DataTable caption="Số đo của buổi tập" rowKey={(sample) => sample.key} rows={samples.map((sample, index) => ({ ...sample, key: index }))} empty={<EmptyState title="Chưa có số đo" />} columns={[
      { key: 'time', header: 'Thời điểm ghi', nowrap: true, render: (sample) => clockTime(sample.recordedAt) }, { key: 'hr', header: 'Nhịp tim', render: (sample) => metric(sample.heartRate, 'bpm') }, { key: 'speed', header: 'Tốc độ', render: (sample) => metric(sample.speedKmh, 'km/h') }, { key: 'distance', header: 'Quãng đường', render: (sample) => metric(sample.distanceM, 'm') }, { key: 'source', header: 'Nguồn', render: (sample) => viLabel(sample.source) },
    ]} /></div></Card>
    <p className="text-caption">Số liệu do máy chủ ghi nhận; ở đây không tính công thức quãng đường, điểm thành tích hay thời gian hồi phục.</p>
  </div><aside className="evaluation-stack"><Card title="Đánh giá của Trainer"><p>{data.evaluation ? RESULT_LABELS[data.evaluation.result] : 'Chưa ghi nhận'}</p></Card><Card title="Kế hoạch bài tập"><ul className="evaluation-list">{session.exercises.map((exercise) => <li key={exercise.id}><strong>{exercise.exerciseName}</strong><p>{metric(exercise.distanceM, 'm')} · {metric(exercise.repetitions, 'lượt')} · {display(viLabel(exercise.intensity))}</p></li>)}</ul><p className="text-caption">Hệ thống chưa cung cấp mức hoàn thành bài tập và số liệu từng lượt lặp.</p></Card>
    <Card title="Cảnh báo đã phát">{data.alerts.length ? <div className="evaluation-stack-sm">{data.alerts.map((alert) => <AlertBanner key={alert.id} type="danger" title={`${viLabel(alert.severity)} · Nhịp tim ${alert.metricValue} bpm > ${alert.thresholdApplied} bpm`} children={`${clockTime(alert.raisedAt)} · ${alert.acknowledgedAt ? `Đã xác nhận lúc ${clockTime(alert.acknowledgedAt)}` : 'Chưa xác nhận'}${alert.actionTaken ? ` · ${alert.actionTaken}` : ''}${alert.escalatedToVetAt ? ` · Đã chuyển Veterinarian lúc ${clockTime(alert.escalatedToVetAt)}` : ''}`} />)}</div> : <EmptyState title="Không có cảnh báo nghiêm trọng" />}</Card><FeedbackCard data={data} />
    {(session.status === 'INTERRUPTED' || data.alerts.length > 0) && <Card title="Chuyển xử lý y tế"><AlertBanner type="danger" title="Nếu liên quan y tế, hãy chuyển sang quy trình y tế">Veterinarian có thể mở hoặc liên kết một ca y tế. Đánh giá này không thay đổi khả năng tập luyện.</AlertBanner></Card>}</aside></div>;
}

function ComparisonPanel({ data }: { data: SessionResultView }) {
  const { actual, session } = data;
  const comparisons = [
    { measure: 'Quãng đường', planned: 'Xem kế hoạch từng bài tập bên dưới', actual: metric(actual.totalDistanceM, 'm') },
    { measure: 'Thời lượng', planned: 'Xem kế hoạch từng bài tập bên dưới', actual: metric(actual.durationMin, 'phút') },
    { measure: 'Cường độ buổi tập', planned: display(viLabel(session.intensity)), actual: 'Hệ thống chưa cung cấp' },
    { measure: 'Nhịp tim cao nhất', planned: 'Chưa có ngưỡng cho buổi tập', actual: metric(actual.maxHeartRate, 'bpm') },
    { measure: 'Tốc độ tối đa', planned: 'Chưa có mục tiêu', actual: metric(actual.maxSpeedKmh, 'km/h') },
    { measure: 'Tốc độ trung bình', planned: 'Chưa có mục tiêu', actual: metric(actual.avgSpeedKmh, 'km/h') },
  ];
  return <div className="evaluation-stack"><Card title="Kế hoạch so với thực tế"><div className="evaluation-table"><DataTable caption="Số liệu kế hoạch so với thực tế của buổi tập" rows={comparisons} rowKey={(row) => row.measure} columns={[
    { key: 'measure', header: 'Chỉ số', render: (row) => row.measure }, { key: 'planned', header: 'Kế hoạch', render: (row) => row.planned }, { key: 'actual', header: 'Thực tế', render: (row) => row.actual },
  ]} /></div></Card><Card title="Bài tập theo kế hoạch"><div className="evaluation-table"><DataTable caption="Bài tập theo kế hoạch, đơn vị gốc" rows={[...session.exercises].sort((a, b) => a.exerciseOrder - b.exerciseOrder)} rowKey={(row) => row.id} empty={<EmptyState title="Chưa có kế hoạch bài tập" />} columns={[
    { key: 'exercise', header: 'Bài tập', render: (row) => row.exerciseName }, { key: 'distance', header: 'Quãng đường', render: (row) => metric(row.distanceM, 'm') }, { key: 'duration', header: 'Thời lượng', render: (row) => metric(row.durationMin, 'phút') }, { key: 'reps', header: 'Số lần lặp', render: (row) => metric(row.repetitions, 'reps') }, { key: 'rest', header: 'Thời gian nghỉ', render: (row) => metric(row.restIntervalMin, 'phút') },
  ]} /></div></Card><p className="text-caption">Giá trị trống nghĩa là chưa đo. Quãng đường kế hoạch không được cộng dồn hay nhân với số lần lặp trong khi cách tính đang chờ phê duyệt. So sánh này không thay đổi kế hoạch.</p></div>;
}
