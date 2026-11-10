import { HorsePhotoImage } from '../horses/shared/HorsePhotoImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { FormEvent } from 'react';
import { ButtonLink, AlertBanner, Button, Card, DataTable, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TextAreaField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { INCIDENT_TYPE_CODES, isIncidentType, type IncidentType } from '../../shared/incidents/incidentTypes';
import { dateTime, metric, type SessionExercise } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createSessionApi, INCIDENT_SEVERITIES, isObservedSeverity, type ObservedSeverity, type ReportIssueResult } from './sessionApi';
import { EditSession } from './EditSession';
import { GroomAssignment } from './GroomAssignment';
import styles from '../main-flows/flow.module.css';
import { serverText } from '../../shared/serverText';
import { viLabel } from '../../shared/viLabels';

interface IncidentDraft {
  open: boolean;
  busy: boolean;
  description: string;
  type: IncidentType | '';
  severity: ObservedSeverity | '';
  error: string;
}

function emptyIncidentDraft(): IncidentDraft {
  return { open: false, busy: false, description: '', type: '', severity: '', error: '' };
}

export function SessionDetailPage() {
  const { id } = useParams();
  return <SessionDetailContent key={id} id={id} />;
}

function SessionDetailContent({ id }: { id?: string }) {
  const { user } = useAuth(), request = useFlowRequest();
  const api = useMemo(() => createSessionApi(request), [request]);
  const load = useCallback((signal: AbortSignal) => api.read(idOf(id), signal), [api, id]);
  const resource = useResource(load), [editing, setEditing] = useState(false);
  const active = useRef(true);
  const [reportDraftState, setReportDraftState] = useState<IncidentDraft>(emptyIncidentDraft);
  const [issueResult, setIssueResult] = useState<{ sessionId: number; result: ReportIssueResult }>();
  const reportDraft = reportDraftState;
  const updateReportDraft = (update: Partial<IncidentDraft>) => setReportDraftState((current) => ({ ...current, ...update }));
  const resultForSession = issueResult?.sessionId === Number(id) ? issueResult : undefined;
  const session = resource.data;
  const canEdit = !!session && session.status === 'SCHEDULED' && (user?.roles.includes('TRAINER') ?? false);
  const canAssignGroom = canEdit && !session?.preSessionCheck;
  const canReportIncident = !!session && (user?.roles.includes('TRAINER') ?? false) && ['IN_PROGRESS', 'PAUSED'].includes(session.status);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reportDraft.busy) return;
    const description = reportDraft.description.trim();
    if (!description || description.length > 1000) { updateReportDraft({ error: 'Nhập mô tả sự cố (tối đa 1000 ký tự).' }); return; }
    if (!isIncidentType(reportDraft.type) || !isObservedSeverity(reportDraft.severity)) { updateReportDraft({ error: 'Chọn loại sự cố và mức độ nghiêm trọng.' }); return; }
    const sessionId = idOf(id);
    updateReportDraft({ busy: true, error: '' });
    try {
      const result = await api.reportIssue(sessionId, { description, incidentType: reportDraft.type, observedSeverity: reportDraft.severity });
      if (!active.current) return;
      setIssueResult({ sessionId, result });
      updateReportDraft({ open: false, description: '', type: '', severity: '', error: '' });
      resource.reload();
    } catch (error) {
      if (active.current) updateReportDraft({ error: errorMessage(error) });
    } finally {
      if (active.current) updateReportDraft({ busy: false });
    }
  }
  const role = user?.roles.find((value) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'].includes(value)) ?? 'TRAINER';
  return <FlowShell title={session ? `${session.focus || 'Buổi tập'} · ${session.phaseName}` : 'Chi tiết buổi tập'} description={session ? `${session.horse.name} · ${session.horse.horseCode} · ${session.sessionCode} · ${dateTime(session.scheduledStart)}` : undefined} section="Lịch tập" role={role} actions={<>
    <Button variant="tertiary" onClick={resource.reload} disabled={resource.pending}>Tải lại buổi tập</Button>
    <ButtonLink to="/training/calendar">Xem trên lịch</ButtonLink>
    {session && !['COMPLETED', 'INTERRUPTED'].includes(session.status) && <ButtonLink to={`/training/sessions/${session.id}/evaluation`}>Xem kết quả & điều kiện đánh giá</ButtonLink>}
    {canEdit && <Button onClick={() => setEditing(true)}>Sửa buổi tập</Button>}
    {session && ['IN_PROGRESS', 'PAUSED'].includes(session.status) && <ButtonLink variant="primary" to={`/training/monitoring?sessionId=${session.id}`}>Mở giám sát trực tiếp</ButtonLink>}
    {session && ['COMPLETED', 'INTERRUPTED'].includes(session.status) && <ButtonLink variant="primary" to={`/training/sessions/${session.id}/evaluation`}>Mở đánh giá của Trainer</ButtonLink>}
  </>}>
    {resource.pending && <LoadingState label="Đang tải buổi tập…" />}{resource.error && <ErrorState title="Không tải được buổi tập" description={resource.error} onRetry={resource.reload} />}
    {resultForSession && <AlertBanner feedback type="success" title="Đã báo cáo sự cố">Sự cố {resultForSession.result.incidentCode} (ID {resultForSession.result.incidentId}) đã được ghi nhận. Trạng thái buổi tập: {viLabel(resultForSession.result.sessionStatus)}.</AlertBanner>}
    {session && canAssignGroom && !session.groom && <Card title="Bước tiếp theo · Phân công Groom">
      <div className={styles.stack}>
        <p>Buổi tập đã lên lịch. Chọn và lưu người kiểm tra trước buổi tập để buổi này xuất hiện trong lịch của Groom.</p>
        <GroomAssignment api={api} session={session} onSaved={resource.reload} />
      </div>
    </Card>}
    {canReportIncident && <Card title="Trainer báo cáo sự cố">
      {reportDraft.open
        ? <form aria-label="Báo cáo sự cố" className={styles.stack} onSubmit={(event) => void submitIncident(event)}>
          <TextAreaField label="Mô tả sự cố" required maxLength={1000} value={reportDraft.description} onChange={(event) => updateReportDraft({ description: event.target.value })} />
          <SelectField label="Loại sự cố" value={reportDraft.type} placeholder="Chọn loại sự cố" required options={INCIDENT_TYPE_CODES.map((value) => ({ value, label: value === 'OTHER' ? 'Khác' : viLabel(value) }))} onChange={(event) => updateReportDraft({ type: isIncidentType(event.target.value) ? event.target.value : '' })} />
          <SelectField label="Mức độ nghiêm trọng" value={reportDraft.severity} placeholder="Chọn mức độ" required options={INCIDENT_SEVERITIES.map((value) => ({ value, label: viLabel(value) }))} onChange={(event) => updateReportDraft({ severity: isObservedSeverity(event.target.value) ? event.target.value : '' })} />
          {reportDraft.error && <AlertBanner feedback type="danger" title="Chưa gửi được báo cáo">{reportDraft.error}</AlertBanner>}
          <div className={styles.row}><Button type="submit" disabled={reportDraft.busy}>{reportDraft.busy ? 'Đang gửi báo cáo…' : 'Gửi báo cáo sự cố'}</Button><Button type="button" variant="tertiary" disabled={reportDraft.busy} onClick={() => updateReportDraft({ open: false, error: '' })}>Hủy</Button></div>
        </form>
        : <Button onClick={() => updateReportDraft({ open: true, error: '' })}>Báo cáo sự cố</Button>}
    </Card>}
    {session && <><AlertBanner type={session.blocked || session.status === 'INTERRUPTED' ? 'danger' : 'info'} title={session.blocked ? `${viLabel(session.status)} · bị chặn bắt đầu` : viLabel(session.status)}>{serverText(session.blockedMessage) || session.interruptionReason || (session.status === 'SCHEDULED' ? 'Work Rider được phân công bắt đầu buổi tập sau khi Groom kiểm tra trước buổi tập đạt và các điều kiện y tế được thông qua.' : 'Trạng thái buổi tập lấy từ hệ thống.')} {session.blockedReasons?.map((reason) => viLabel(reason)).join(' · ')}</AlertBanner>
      <Card><div className={styles.factGrid}><KeyValue label="Mã buổi tập" value={session.sessionCode} /><KeyValue label="Ngày & giờ" value={dateTime(session.scheduledStart)} /><KeyValue label="Mặt sân" value={session.surface ?? 'Chưa xác định'} /><KeyValue label="Trọng tâm buổi tập" value={session.focus ?? 'Chưa xác định'} /><KeyValue label="Cường độ buổi tập" value={viLabel(session.intensity, 'Chưa xác định')} /><KeyValue label="Trạng thái" value={<StatusBadge family="session" status={session.status} />} /></div></Card>
      <div className={styles.columns}><div className={styles.stack}><Card title="Kế hoạch bài tập"><div className={styles.table}><DataTable<SessionExercise> caption="Kế hoạch bài tập của buổi" rows={session.exercises ?? []} rowKey={(item) => item.id} columns={[{ key: 'name', header: 'Bài tập', render: (item) => item.exerciseName }, { key: 'distance', header: 'Quãng đường / thời lượng', render: (item) => `${metric(item.distanceM, 'm')} / ${metric(item.durationMin, 'phút')}` }, { key: 'reps', header: 'Số lần lặp', render: (item) => item.repetitions ?? '—' }, { key: 'rest', header: 'Nghỉ ngơi', render: (item) => metric(item.restIntervalMin, 'phút') }, { key: 'intensity', header: 'Cường độ', render: (item) => item.intensity ?? 'Chưa xác định' }]} /></div><p className="text-caption">Thay đổi ở cấp buổi tập không bao giờ thay đổi chiến lược chương trình hay mẫu gốc.</p></Card><Card title={session.status === 'INTERRUPTED' ? 'Thông tin gián đoạn' : 'Các bước tiếp theo'}><div className={styles.stack}>{session.status === 'INTERRUPTED' ? <><KeyValue label="Bắt đầu" value={dateTime(session.actualStart)} /><KeyValue label="Dừng" value={dateTime(session.actualEnd)} /><p>{session.interruptionReason ?? 'Không có lý do.'}</p><p>Trạng thái vẫn là Bị gián đoạn. Phản hồi người cưỡi và đánh giá của Trainer tiếp tục dựa trên kết quả này.</p></> : <SessionNextSteps status={session.status} />}</div></Card></div>
      <div className={styles.stack}><Card title="Nhân sự & ngựa"><HorsePhotoImage path={`/api/training-sessions/${session.id}/horse-photo`} name={session.horse.name} /><div className={styles.stack}><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Chưa cung cấp'} /><KeyValue label="Work Rider" value={session.workRider?.fullName ?? 'Chưa phân công'} /><KeyValue label="Groom" value={session.groom?.fullName ?? 'Chưa phân công'} />{session.status === 'SCHEDULED' && !session.groom && <p>Trainer cần lưu phân công Groom cho buổi này trước khi Groom có thể kiểm tra.</p>}{canAssignGroom && session.groom && <GroomAssignment api={api} session={session} onSaved={resource.reload} />}<KeyValue label="Ngựa" value={`${session.horse.name} · ${session.horse.horseCode}`} /></div></Card><Card title="Trước buổi tập & y tế"><div className={styles.stack}><KeyValue label="Khả năng tập luyện do Veterinarian đặt" value={<StatusBadge family="availability" status={session.trainingAvailability} />} /><p>Ngựa sẵn sàng tập luyện không đồng nghĩa buổi tập đã đủ điều kiện bắt đầu.</p><KeyValue label="Kiểm tra của Groom cho buổi này" value={viLabel(session.preSessionCheck?.overallResult, 'Chưa có kết quả được lưu cho buổi này')} /><p>{session.blockedMessage ?? 'Do Veterinarian đặt; hệ thống kiểm tra lại trước khi bắt đầu.'}</p><ButtonLink to={`/medical/restrictions?horseId=${session.horse.id}`}>Xem lý do hạn chế</ButtonLink></div></Card></div></div>
    {editing && session && <EditSession api={api} session={session} onClose={() => setEditing(false)} onSaved={resource.reload} />}
    </>}
  </FlowShell>;
}

/** Guidance follows the server state; it never grants or executes a transition. */
function SessionNextSteps({ status }: { status: string }) {
  if (status === 'COMPLETED') return <><p>1. Xem kết quả đã ghi và so sánh kế hoạch với thực tế.</p><p>2. Trainer ghi đánh giá và khuyến nghị cho buổi tập đã hoàn thành.</p><p>3. Xem phản hồi của Work Rider và lịch sử thành tích.</p></>;
  if (status === 'IN_PROGRESS' || status === 'PAUSED') return <><p>1. Mở giám sát trực tiếp để xem diễn biến và cảnh báo.</p><p>2. Work Rider được phân công thực hiện thao tác tiếp theo theo các điều kiện máy chủ cho phép.</p><p>3. Sau khi kết thúc, Work Rider gửi phản hồi và Trainer đánh giá kết quả.</p></>;
  if (status !== 'SCHEDULED') return <p>Xem trạng thái và kết quả hiện tại do máy chủ cung cấp.</p>;
  return <><p>1. Trainer phân công Groom cho đúng mã buổi tập.</p><p>2. Groom chọn đúng buổi tập và lưu đủ năm quan sát. Kết quả của buổi khác không thay thế được.</p><p>3. Kiểm tra khả năng tập luyện, hạn chế y tế và giờ đã lên lịch.</p><p>4. Work Rider được phân công bắt đầu buổi tập khi các điều kiện đều đạt.</p><p>5. Theo dõi số liệu trong Giám sát trực tiếp.</p></>;
}
