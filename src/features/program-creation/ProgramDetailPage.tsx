import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ButtonLink, AlertBanner, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, StatusBadge, Tabs } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { dateTime, metric } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createProgramDetailApi, type ProgramHistoryEntry, type ProgramProgress } from './programDetailApi';
import { HeadTrainerProgramActions, TrainerAdjustmentAction } from './ProgramActions';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

/** SCR-TRAIN-002/022: read-only Overview, Progress and History. Row scope remains enforced by Backend. */
export function ProgramDetailPage() {
  const { id } = useParams();
  return <ProgramDetailContent key={id} rawId={id} />;
}
function ProgramDetailContent({ rawId }: { rawId?: string }) {
  const { user } = useAuth(), request = useFlowRequest(), api = useMemo(() => createProgramDetailApi(request), [request]);
  const [tab, setTab] = useState('overview');
  const load = useCallback(async (signal: AbortSignal) => api.read(idOf(rawId), signal), [api, rawId]);
  const program = useResource(load), data = program.data;
  const canReadHistory = user?.roles.some((role) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER'].includes(role)) ?? false;
  const role = user?.roles.find((value) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER', 'VETERINARIAN', 'GROOM'].includes(value)) ?? 'HEAD_TRAINER';
  return <FlowShell title={data ? `${data.horse.name} · ${data.horse.horseCode}` : 'Chi tiết chương trình'} description={data?.name} section="Horse Training Programs" role={role} actions={<div className={styles.row}>
    {user?.roles.includes('HEAD_TRAINER') && <ButtonLink to="/training/programs">Quay lại danh sách chương trình</ButtonLink>}
    {user?.roles.includes('TRAINER') && <ButtonLink to="/training/programs/assigned">Quay lại chương trình được giao</ButtonLink>}
    {data && user?.roles.includes('HEAD_TRAINER') && <HeadTrainerProgramActions program={data} onChanged={program.reload} />}
    {data && user?.roles.includes('TRAINER') && <TrainerAdjustmentAction program={data} onSubmitted={program.reload} />}
    <ButtonLink to="/dashboard">Quay lại không gian làm việc</ButtonLink>
  </div>}>
    {program.pending && <LoadingState label="Đang tải chương trình…" />}
    {program.error && <ErrorState title="Không tải được chương trình" description={program.error} onRetry={program.reload} />}
    {data && <><Card><div className={styles.factGrid}>
      <KeyValue label="Chương trình" value={data.name} /><KeyValue label="Trạng thái chương trình" value={<StatusBadge family="program" status={data.status} />} />
      <KeyValue label="Trainer phụ trách" value={data.currentTrainer?.fullName ?? 'Chưa cung cấp'} /><KeyValue label="Thời gian" value={`${data.periodStart} → ${data.periodEnd}`} />
      <KeyValue label="Giai đoạn hiện tại" value={data.currentPhaseName ?? 'Chưa cung cấp'} /><KeyValue label="Khả năng tập luyện" value={data.trainingAvailability ? <StatusBadge family="availability" status={data.trainingAvailability} /> : 'Chưa cung cấp'} />
      <KeyValue label="Mẫu gốc" value={data.sourceTemplateName ?? data.sourceTemplateCode ?? `Mẫu ${data.sourceTemplateId}`} />
      <KeyValue label="Phiên bản mẫu" value={`v${data.sourceTemplateVersion}`} /><KeyValue label="Kích hoạt" value={dateTime(data.activatedAt)} />
      {(user?.roles.includes('HEAD_TRAINER') || user?.roles.includes('TRAINER')) && <KeyValue label="Yêu cầu điều chỉnh đang chờ" value={<Link to="/training/adjustment-requests">{data.pendingAdjustmentRequests ?? 0}</Link>} />}
    </div></Card>
      <Tabs label="Chi tiết chương trình" idPrefix="program-detail" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Tổng quan' }, { value: 'progress', label: 'Tiến độ' }, { value: 'history', label: 'Lịch sử' }]} />
      <section role="tabpanel" id={`program-detail-panel-${tab}`} aria-labelledby={`program-detail-tab-${tab}`}>
        {tab === 'overview' ? <div className={styles.columns}><div className={styles.stack}><Card title="Tóm tắt chương trình"><div className={styles.fields}><KeyValue label="Mục tiêu chính" value={data.goals ?? 'Chưa cung cấp'} /><KeyValue label="Chỉ số mục tiêu" value={data.targetMetrics ?? 'Chưa cung cấp'} /><KeyValue label="Tiến độ chung" value="Chưa cung cấp; không tự suy ra phần trăm" /></div></Card>
          <Card title="Dòng thời gian các giai đoạn"><div className={styles.stack}>{[...data.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase) => <Card key={phase.id} title={`${phase.phaseOrder}. ${phase.name}`}><div className={styles.fields}>
            <KeyValue label="Mục tiêu" value={phase.objective ?? 'Chưa cung cấp'} /><KeyValue label="Thời gian giai đoạn" value={`${phase.startDate} → ${phase.endDate}`} />
            <KeyValue label="Khối lượng" value={phase.workload ?? 'Chưa cung cấp'} /><KeyValue label="Khoảng cường độ" value={`${viLabel(phase.intensityMin, 'Chưa cung cấp')} → ${viLabel(phase.intensityMax, 'Chưa cung cấp')}`} />
          </div></Card>)}{data.phases.length === 0 && <EmptyState title="Chưa có giai đoạn huấn luyện" />}</div></Card>
        </div><div className={styles.stack}><Card title="Ghi chú của Head Trainer"><p>{data.notes ?? 'Chưa cung cấp'}</p></Card><AlertBanner type="info" title="Chiến lược chương trình">Mẫu gốc đã chọn không bao giờ thay đổi. Trainer đề xuất thay đổi chiến lược; Head Trainer quyết định và quản lý trạng thái chương trình cùng việc phân công Trainer.</AlertBanner></div></div>
          : canReadHistory ? <ProgramReadTab key={tab} tab={tab} programId={data.id} /> : <EmptyState title={`Vai trò này không xem được ${tab === 'progress' ? 'tiến độ' : 'lịch sử'}`} description="Chỉ Head Trainer, Trainer và Club Manager được xem mục này." />}
      </section>
    </>}
  </FlowShell>;
}
function ProgramReadTab({ tab, programId }: { tab: string; programId: number }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramDetailApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => tab === 'progress' ? api.progress(programId, signal) : api.history(programId, signal), [api, programId, tab]);
  const resource = useResource(load);
  return <Card title={tab === 'progress' ? 'Tiến độ chương trình' : 'Lịch sử chương trình'}>
    {resource.pending && <LoadingState label={`Đang tải ${tab === 'progress' ? 'tiến độ' : 'lịch sử'}…`} />}
    {resource.error && <ErrorState title={`${tab === 'progress' ? 'Tiến độ' : 'Lịch sử'} unavailable`} description={resource.error} onRetry={resource.reload} />}
    {resource.data && (tab === 'progress' ? <div className={styles.table}><DataTable<ProgramProgress['phases'][number]> caption="Tiến độ chương trình từ hệ thống" rows={(resource.data as ProgramProgress).phases} rowKey={(item) => item.phaseId} empty={<EmptyState title="Chưa có tiến độ giai đoạn" />} columns={[
      { key: 'phase', header: 'Giai đoạn', render: (item) => `${item.phaseOrder}. ${item.name}` },
      { key: 'scheduled', header: 'Đã lên lịch', render: (item) => item.scheduled }, { key: 'completed', header: 'Đã hoàn thành', render: (item) => item.completed },
      { key: 'interrupted', header: 'Bị gián đoạn', render: (item) => item.interrupted }, { key: 'distance', header: 'Quãng đường (hệ thống)', render: (item) => metric(item.totalDistanceM, 'm') },
      { key: 'evaluation', header: 'Đánh giá gần nhất', render: (item) => item.lastEvaluationLabel ?? 'Chưa cung cấp' },
    ]} /></div> : <div className={styles.table}><DataTable<ProgramHistoryEntry> caption="Lịch sử chương trình từ hệ thống" rows={resource.data as ProgramHistoryEntry[]} rowKey={(item) => `${item.occurredAt}-${item.entryType}-${item.summary}`} empty={<EmptyState title="Chưa có lịch sử chương trình" />} columns={[
      { key: 'time', header: 'Thời gian', nowrap: true, render: (item) => dateTime(item.occurredAt) }, { key: 'type', header: 'Sự kiện', render: (item) => item.entryType },
      { key: 'actor', header: 'Người thực hiện', render: (item) => item.actor?.fullName ?? 'Chưa cung cấp' }, { key: 'summary', header: 'Tóm tắt', render: (item) => item.summary },
    ]} /></div>)}
  </Card>;
}
