import { useCallback, useMemo, useState } from 'react';
import { ButtonLink, Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge } from '../../design-system';
import { FlowShell } from '../main-flows/FlowShell';
import { useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createSessionApi, type TrainingSession } from './sessionApi';
import { dateTime } from '../evaluation/models';
import styles from '../main-flows/flow.module.css';

export function TrainerDashboardPage() {
  const request = useFlowRequest(), api = useMemo(() => createSessionApi(request), [request]);
  const [range] = useState(() => { const today = new Date(); today.setHours(0, 0, 0, 0); const from = new Date(today); from.setDate(from.getDate() - 7); const end = new Date(today); end.setDate(end.getDate() + 7); return { today: today.toISOString(), from: from.toISOString(), to: end.toISOString() }; });
  const loadSessions = useCallback((signal: AbortSignal) => api.sessions(range.from, range.to, signal), [api, range]);
  const loadPrograms = useCallback((signal: AbortSignal) => api.programs(signal), [api]);
  const sessions = useResource(loadSessions), programs = useResource(loadPrograms);
  const loadReview = useCallback(async (signal: AbortSignal) => {
    if (!sessions.data) return null;
    const details = await Promise.all(sessions.data.filter((item) => ['COMPLETED', 'INTERRUPTED'].includes(item.status)).map((item) => api.read(item.id, signal)));
    return { items: details.filter((item) => item.hasEvaluation === false), unknown: details.some((item) => typeof item.hasEvaluation !== 'boolean') };
  }, [api, sessions.data]);
  const reviewResource = useResource(loadReview);
  const today = sessions.data?.filter((item) => new Date(item.scheduledStart).toDateString() === new Date(range.today).toDateString());
  const upcoming = sessions.data?.filter((item) => item.scheduledStart >= range.today && item.status === 'SCHEDULED');
  const review = reviewResource.data?.items;
  return <FlowShell title="Tổng quan Trainer" description="Ngựa, buổi tập và ưu tiên huấn luyện được giao hôm nay." section="Huấn luyện" role="TRAINER" actions={<div className={styles.row}><ButtonLink to="/training/calendar">Xem lịch</ButtonLink><ButtonLink variant="primary" to="/training/schedule/session/new">+ Tạo buổi tập</ButtonLink></div>}>
    <div className={styles.metrics}><MetricCard label="Buổi tập hôm nay" value={today ? String(today.length) : '—'} caption="Buổi tập được giao hôm nay" /><MetricCard label="Sắp tới trong tuần" value={upcoming ? String(upcoming.length) : '—'} caption="Đã lên lịch trong khoảng đang xem" /><MetricCard label="Cần đánh giá" value={review && !reviewResource.data?.unknown ? String(review.length) : '—'} caption="Mức sẵn sàng đánh giá từ hệ thống" /><MetricCard label="Chương trình được giao" value={programs.data ? String(programs.data.totalItems) : '—'} caption="Phân công theo phạm vi hệ thống" /></div>
    <div className={`${styles.columns} ${styles.columnsStackNarrow}`}><Card title="Buổi tập hôm nay">{sessions.pending && <LoadingState label="Đang tải buổi tập…" />}{sessions.error && <ErrorState title="Không tải được buổi tập" description={sessions.error} onRetry={sessions.reload} />}{today && <div className={styles.table}><DataTable<TrainingSession> caption="Buổi tập được giao hôm nay" rows={today} rowKey={(item) => item.id} empty={<EmptyState title="Hôm nay không có buổi tập" />} columns={[
      { key: 'time', header: 'Giờ', nowrap: true, render: (item) => dateTime(item.scheduledStart).split(' · ').pop() },
      { key: 'horse', header: 'Ngựa · buổi tập', render: (item) => <div className={styles.cellStack}><strong>{item.horse.name}</strong><span className={styles.cellCode} title={item.sessionCode}>{item.sessionCode}</span></div> },
      { key: 'rider', header: 'Work Rider', render: (item) => item.workRider?.fullName ?? 'Chưa phân công' },
      { key: 'status', header: 'Trạng thái', nowrap: true, render: (item) => <StatusBadge family="session" status={item.status} /> }, { key: 'view', header: '', nowrap: true, render: (item) => <ButtonLink size="sm" variant="secondary" to={`/training/session/${item.id}`} aria-label={`Xem buổi tập ${item.sessionCode}`}>Xem</ButtonLink> },
    ]} /></div>}</Card><Card title="Cần chú ý"><div className={styles.stack}><p>Buổi tập đã hoàn thành hoặc bị gián đoạn đang chờ bạn đánh giá.</p>{reviewResource.error && <ErrorState title="Chưa có thông tin sẵn sàng đánh giá" description={reviewResource.error} onRetry={reviewResource.reload} />}{reviewResource.data?.unknown && <p>Một số buổi tập chưa có thông tin sẵn sàng đánh giá. Không tự suy ra số lượng chờ.</p>}{review?.map((item) => <Card key={item.id} title={item.horse.name}><div className={styles.stack}><StatusBadge family="session" status={item.status} /><span>{dateTime(item.scheduledStart)} · {item.sessionCode}</span><ButtonLink to={`/training/sessions/${item.id}/evaluation`}>Xem lại</ButtonLink></div></Card>)}{review?.length === 0 && !reviewResource.data?.unknown && <EmptyState title="Không có buổi tập chờ đánh giá" />}</div></Card></div>
    <Card title="Chương trình huấn luyện được giao" action={<ButtonLink to="/training/programs/assigned">Xem tất cả chương trình được giao →</ButtonLink>}>{programs.pending && <LoadingState label="Đang tải phân công…" />}{programs.error && <ErrorState title="Không tải được chương trình" description={programs.error} onRetry={programs.reload} />}<div className={styles.factGrid}>{programs.data?.items.map((item) => <Card title={item.horse.name} key={item.id}><div className={styles.stack}><p>{item.horse.horseCode} · {item.name}</p>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}<p>Giai đoạn hiện tại: {item.currentPhaseName ?? 'Chưa cung cấp'}</p><ButtonLink to={`/training/schedule/session/new?programId=${item.id}`}>Lên lịch buổi tập</ButtonLink></div></Card>)}</div>{programs.data?.items.length === 0 && <EmptyState title="Chưa có chương trình được giao" />}</Card>
  </FlowShell>;
}
