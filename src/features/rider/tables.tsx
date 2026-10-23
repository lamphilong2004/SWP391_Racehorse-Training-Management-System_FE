import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ButtonLink, Card, DataTable, EmptyState, Icon, MetricCard, StatusBadge, Tabs, type DataTableColumn } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RiderApi, RiderHistory } from './api';
import { ReadState } from './common';
import type { RiderSession } from './types';
import styles from './rider.module.css';

/** Figma WR-D4 (426:10287) My Riding Assignments and WR-D5 (427:10371) My Riding History. */

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** Figma formats: 24-hour time, "Thu 22 · 06:30", "Tue 20 Oct · 06:00". */
const FORMAT_LOCALE = 'vi-VN';
const time = (value: string) => new Date(value).toLocaleTimeString(FORMAT_LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayTime = (value: string) => `${new Date(value).toLocaleDateString(FORMAT_LOCALE, { weekday: 'short', day: 'numeric' })} · ${time(value)}`;
const dateTime = (value: string) => `${new Date(value).toLocaleDateString(FORMAT_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time(value)}`;
const dayTitle = (value: Date) => value.toLocaleDateString(FORMAT_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
/** Minutes between two server timestamps; null when either is missing. No other duration is inferred. */
const minutes = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const value = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
  return Number.isFinite(value) && value >= 0 ? value : null;
};
const sessionLabel = (ride: RiderSession) => [ride.focus, ride.phaseName].filter(Boolean).join(' · ') || ride.sessionCode;

function HorseCell({ ride }: { ride: RiderSession }) {
  return <div className={styles.cellStack}><span className={styles.strong}>{ride.horse.name}</span><span className={styles.caption}>{ride.horse.horseCode}</span></div>;
}
const chevron: DataTableColumn<RiderSession> = { key: 'open', header: 'Thao tác', width: 144, render: (ride) => <ButtonLink size="sm" to={`/rider/assignments/${ride.id}`} aria-label={`Xem lượt cưỡi ${ride.horse.name}`} onClick={(event) => event.stopPropagation()}>Xem lượt cưỡi<Icon name="chevron-right" size={16} /></ButtonLink> };

function preCheck(ride: RiderSession, today: boolean) {
  const result = ride.preSessionCheck?.overallResult ?? ride.preCheckResult;
  if (result === 'ABNORMAL' || (ride.blocked && result === 'ALL_NORMAL')) return <span className={styles.toneDanger}>Bị chặn bắt đầu</span>;
  if (result === 'ALL_NORMAL') return <span className={styles.toneSuccess}>Sẵn sàng</span>;
  return today ? <span className={styles.toneWarning}>Chưa kiểm tra</span> : <span className={styles.muted}>Đã lên lịch</span>;
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const { handleApiError } = useAuth();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((value) => { if (active) setData(value); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists the inputs of `load`.
  }, [...deps, attempt, handleApiError]);
  return { data, error, retry: () => { setError(undefined); setData(undefined); setAttempt((value) => value + 1); } };
}

export function AssignmentsTable({ api }: { api: RiderApi }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const active = useLoad(() => api.assignments(), [api]);
  const completed = useLoad(() => (tab === 'completed' ? api.assignments('COMPLETED') : Promise.resolve([] as RiderSession[])), [api, tab]);
  const now = new Date();
  const sorted = [...(active.data ?? [])].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const todayRides = sorted.filter((ride) => sameDay(new Date(ride.scheduledStart), now) || ride.status !== 'SCHEDULED');
  const upcomingRides = sorted.filter((ride) => !todayRides.includes(ride));
  const open = (ride: RiderSession) => navigate(`/rider/assignments/${ride.id}`);
  const columns = (today: boolean): DataTableColumn<RiderSession>[] => [
    { key: 'when', header: 'Thời gian', width: 126, render: (ride) => <span className={styles.strong}>{today ? time(ride.scheduledStart) : dayTime(ride.scheduledStart)}</span> },
    { key: 'horse', header: 'Ngựa', width: 180, render: (ride) => <HorseCell ride={ride} /> },
    { key: 'session', header: 'Buổi tập', render: sessionLabel },
    { key: 'surface', header: 'Mặt sân · thời lượng', width: 160, render: (ride) => <span className={styles.muted}>{[ride.surface, minutes(ride.scheduledStart, ride.scheduledEnd) !== null ? `${minutes(ride.scheduledStart, ride.scheduledEnd)} phút` : null].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'trainer', header: 'Trainer', width: 110, render: (ride) => <span className={styles.muted}>{ride.trainer?.fullName ?? '—'}</span> },
    { key: 'status', header: 'Trạng thái', width: 110, render: (ride) => <StatusBadge family="session" status={ride.status} /> },
    { key: 'precheck', header: 'Pre-check', width: 128, render: (ride) => preCheck(ride, today) },
    chevron,
  ];
  const table = (rows: RiderSession[], today: boolean, caption: string, empty: string) => (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <DataTable columns={columns(today)} rows={rows} rowKey={(ride) => ride.id} onRowClick={open} caption={caption} empty={<EmptyState title={empty} description="Không có lượt cưỡi nào cho lựa chọn này." />} />
    </div>
  );
  const state = tab === 'completed' ? completed : active;
  return (
    <div className={styles.stack}>
      <div className={styles.header}>
        <div><h1 className={styles.heading}>Lịch cưỡi của tôi</h1><p className={styles.muted}>{user?.fullName} · chỉ lịch của bạn</p></div>
        <Tabs label="Khoảng thời gian" value={tab} onChange={(value) => setTab(value as typeof tab)} items={[
          { value: 'today', label: `Hôm nay · ${active.data ? todayRides.length : '–'}` },
          { value: 'upcoming', label: `Sắp tới · ${active.data ? upcomingRides.length : '–'}` },
          { value: 'completed', label: 'Đã hoàn thành' },
        ]} />
      </div>
      <ReadState error={state.error} loading={!state.data} retry={state.retry} />
      {tab !== 'completed' && active.data && (
        <>
          {tab === 'today' && <Card className={styles.tableCard}><p className={styles.overline}>Hôm nay · {dayTitle(now)}</p>{table(todayRides, true, 'Lượt cưỡi hôm nay', 'Hôm nay không có lượt cưỡi')}</Card>}
          <Card className={styles.tableCard}><p className={styles.overline}>Sắp tới</p>{table(upcomingRides, false, 'Lượt cưỡi sắp tới', 'Không có lượt cưỡi sắp tới')}</Card>
        </>
      )}
      {tab === 'completed' && completed.data && <Card className={styles.tableCard}><p className={styles.overline}>Đã hoàn thành</p>{table(completed.data, false, 'Lượt cưỡi đã hoàn thành', 'Chưa có lượt cưỡi hoàn thành')}</Card>}
      <p className={styles.caption}>Chỉ hiển thị lịch của bạn.</p>
    </div>
  );
}

async function allHistory(api: RiderApi): Promise<RiderHistory> {
  const first = await api.history(0);
  const items = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1) items.push(...(await api.history(page)).items);
  return { ...first, items };
}

export function HistoryTable({ api }: { api: RiderApi }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'recent' | 'COMPLETED' | 'INTERRUPTED'>('recent');
  const history = useLoad(() => allHistory(api), [api]);
  const rideTime = (ride: RiderSession) => ride.actualStart ?? ride.scheduledStart;
  const rides = [...(history.data?.items ?? [])].sort((a, b) => rideTime(b).localeCompare(rideTime(a)));
  const now = new Date();
  const month = now.toLocaleDateString(FORMAT_LOCALE, { month: 'short' }).toUpperCase();
  const inMonth = rides.filter((ride) => { const date = new Date(ride.scheduledStart); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
  const shown = tab === 'recent' ? rides : rides.filter((ride) => ride.status === tab);
  const columns: DataTableColumn<RiderSession>[] = [
    { key: 'date', header: 'Ngày · giờ', width: 166, render: (ride) => <span className={styles.strong}>{dateTime(rideTime(ride))}</span> },
    { key: 'status', header: 'Trạng thái', width: 150, render: (ride) => <StatusBadge family="session" status={ride.status} /> },
    { key: 'horse', header: 'Ngựa', width: 130, render: (ride) => <span className={styles.strong}>{ride.horse.name}</span> },
    { key: 'session', header: 'Buổi tập', render: sessionLabel },
    { key: 'trainer', header: 'Trainer', width: 110, render: (ride) => <span className={styles.muted}>{ride.trainer?.fullName ?? '—'}</span> },
    { key: 'surface', header: 'Mặt sân', width: 100, render: (ride) => <span className={styles.muted}>{ride.surface ?? '—'}</span> },
    { key: 'duration', header: 'Thời lượng', width: 80, render: (ride) => <span className={styles.muted}>{minutes(ride.actualStart, ride.actualEnd) !== null ? `${minutes(ride.actualStart, ride.actualEnd)} phút` : '—'}</span> },
    { key: 'feedback', header: 'Phản hồi', width: 80, render: (ride) => (ride.hasRiderFeedback ? <span className={styles.toneSuccess}>Đã gửi</span> : <span className={styles.toneWarning}>Chưa gửi</span>) },
    chevron,
  ];
  return (
    <div className={styles.stack}>
      <div className={styles.header}>
        <div><h1 className={styles.heading}>Lịch sử cưỡi của tôi</h1><p className={styles.muted}>{user?.fullName} · mọi ngựa và chương trình</p></div>
        <Tabs label="Bộ lọc lịch sử" value={tab} onChange={(value) => setTab(value as typeof tab)} items={[
          { value: 'recent', label: 'Gần đây' }, { value: 'COMPLETED', label: 'Đã hoàn thành' }, { value: 'INTERRUPTED', label: 'Bị gián đoạn' },
        ]} />
      </div>
      <ReadState error={history.error} loading={!history.data} retry={history.retry} />
      {history.data && (
        <>
          <div className={styles.metrics3}>
            <MetricCard label={`Lượt cưỡi trong ${month}`} value={String(inMonth.length)} />
            <MetricCard label="Đã hoàn thành" value={String(rides.filter((ride) => ride.status === 'COMPLETED').length)} />
            <MetricCard label="Bị gián đoạn" value={String(rides.filter((ride) => ride.status === 'INTERRUPTED').length)} />
          </div>
          <Card className={styles.tableCard}>
            <div className="table-scroll" role="region" aria-label="Lịch sử cưỡi" tabIndex={0}>
              <DataTable columns={columns} rows={shown} rowKey={(ride) => ride.id} caption="Lịch sử cưỡi" onRowClick={(ride) => navigate(`/rider/assignments/${ride.id}`)} empty={<EmptyState title="Chưa có lượt cưỡi" description="Lượt cưỡi đã hoàn thành và bị gián đoạn sẽ hiện ở đây." />} />
            </div>
          </Card>
        </>
      )}
      <p className={styles.caption}>Chỉ hiển thị lượt cưỡi của bạn. Xu hướng thành tích của ngựa do Trainer xem xét.</p>
    </div>
  );
}
