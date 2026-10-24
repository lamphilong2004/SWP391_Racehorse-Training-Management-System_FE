import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Card, DataTable, EmptyState, Icon, KeyValue, MetricCard, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { useRiderApi } from './data';
import type { RiderSession } from './types';
import styles from './rider.module.css';
import { AssignmentsTable, HistoryTable } from './tables';
import { greeting } from '../../shared/greeting';

export function RiderDashboardPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><Dashboard api={api} /></RiderShell>;
}
export function RiderAssignmentsPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><AssignmentsTable api={api} /></RiderShell>;
}
const CLOCK = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const clock = (iso: string) => (Number.isFinite(Date.parse(iso)) ? CLOCK.format(new Date(iso)) : '—');
const sameDay = (iso: string, day: Date) => { const date = new Date(iso); return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate(); };
const ACTIVE = ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'];
function relative(iso: string, now: number) {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes <= 0) return 'đã đến giờ bắt đầu';
  return minutes < 60 ? `sau ${minutes} phút` : `sau ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
function duration(ride: RiderSession) {
  const minutes = ride.scheduledEnd ? Math.round((Date.parse(ride.scheduledEnd) - Date.parse(ride.scheduledStart)) / 60000) : NaN;
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} phút` : 'Chưa có thời lượng';
}
const preCheck = (ride: RiderSession) => ride.preSessionCheck?.overallResult ?? ride.preCheckResult ?? null;
const preCheckText = (ride: RiderSession) => preCheck(ride) === 'ALL_NORMAL' ? 'Kiểm tra trước buổi tập đạt' : preCheck(ride) === 'ABNORMAL' ? 'Kiểm tra trước buổi tập bất thường' : 'Chưa kiểm tra trước buổi tập';

/** Figma WR-D1 dashboard (416:9660). The full assignment list lives in tables.tsx (WR-D4). */
function Dashboard({ api }: { api: RiderApi }) {
  const { handleApiError, user } = useAuth();
  const [items, setItems] = useState<RiderSession[]>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    api.assignments().then((data) => { if (active) setItems(data); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [api, attempt, handleApiError]);
  const retry = () => { setError(undefined); setItems(undefined); setAttempt((old) => old + 1); };
  const sorted = [...(items ?? [])].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const today = sorted.filter((ride) => sameDay(ride.scheduledStart, new Date(now)));
  const next = sorted.find((ride) => ACTIVE.includes(ride.status));
  const later = today.filter((ride) => ride.id !== next?.id && ride.status === 'SCHEDULED' && Date.parse(ride.scheduledStart) > now);
  return <div className={styles.stack}>
    <div className={styles.header}><div><h1 className={styles.heading}>{greeting()}, {user?.fullName}</h1><p className={styles.muted}>{items ? `Hôm nay bạn có ${today.length} lượt cưỡi · ${DAY.format(new Date(now))}` : 'Chỉ hiển thị lượt cưỡi của tài khoản đang đăng nhập.'}</p></div>
      <div className={styles.actions}><Link className={styles.secondaryLink} to="/rider/history">Lịch sử cưỡi</Link><Link className={styles.secondaryLink} to="/rider/assignments">Xem tất cả lịch phân công</Link></div></div>
    <div className={styles.metrics}>
      <MetricCard label="Lượt cưỡi hôm nay" value={items ? String(today.length) : '—'} />
      <MetricCard label="Đã hoàn thành" value={items ? String(today.filter((ride) => ride.status === 'COMPLETED').length) : '—'} />
      <MetricCard label="Sắp tới" value={items ? String(today.filter((ride) => ride.status === 'SCHEDULED').length) : '—'} />
      <MetricCard label="Lưu ý" value={items ? String(today.filter((ride) => ride.blocked).length) : '—'} />
    </div>
    <ReadState error={error} loading={!items} retry={retry} />
    {items && <>
      <div className={styles.columns}>
        {next ? <Card><div className={styles.smallStack}><p className={styles.eyebrow}>Lượt cưỡi tiếp theo</p>
          <div className={styles.nextRide}><div className={styles.timeTile}><strong>{clock(next.scheduledStart)}</strong><span>{relative(next.scheduledStart, now)}</span></div>
            <div className={styles.smallStack}><h2 className={styles.rideTitle}>{next.horse.name} · {next.horse.horseCode}</h2><p className={styles.muted}>{next.focus || next.sessionCode} · {next.phaseName}</p>
              <div className={styles.badges}><StatusBadge family="session" status={next.status} />{next.trainingAvailability && <StatusBadge family="availability" status={next.trainingAvailability} />}</div>
              <div className={styles.facts}><KeyValue label="Mặt sân · thời lượng" value={`${next.surface ?? 'Chưa có mặt sân'} · ${duration(next)}`} /><KeyValue label="Trainer" value={next.trainer?.fullName ?? 'Chưa cung cấp'} /></div></div></div>
          {!next.blocked && preCheck(next) === 'ALL_NORMAL'
            ? <AlertBanner type="success" title="Sẵn sàng">Kiểm tra trước buổi tập đạt{next.preSessionCheck ? ` at ${clock(next.preSessionCheck.performedAt)}` : ''}.</AlertBanner>
            : <AlertBanner type="warning" title="Chờ điều kiện bắt đầu">{next.blockedMessage || (preCheck(next) === 'ABNORMAL' ? 'Kiểm tra trước buổi tập phát hiện bất thường. Không được bắt đầu buổi tập.'
              : preCheck(next) === 'ALL_NORMAL' && Date.parse(next.scheduledStart) > now ? `Kiểm tra trước buổi tập đạt. Có thể bắt đầu lúc ${clock(next.scheduledStart)}.` : 'Đang chờ kiểm tra trước buổi tập.')}</AlertBanner>}
          <div className={styles.endActions}><Link className={styles.primaryLink} to={`/rider/assignments/${next.id}`}>Xem lịch phân công</Link></div></div></Card>
          : <Card><EmptyState title="Không có lượt cưỡi sắp tới" description="Bạn chưa có lượt cưỡi nào được lên lịch." /></Card>}
        <Card><div className={styles.smallStack}><p className={styles.eyebrowMuted}>Cuối ngày hôm nay</p>
          {later.length === 0 ? <p className={styles.muted}>Hôm nay không còn lượt cưỡi nào khác.</p> : later.map((ride) => <div key={ride.id} className={styles.laterRide}><span className={styles.timeChip}>{clock(ride.scheduledStart)}</span><div className={styles.cellStack}><strong>{ride.horse.name} · {ride.horse.horseCode}</strong><span className={styles.muted}>{ride.focus || ride.sessionCode} · {ride.phaseName}</span><span className={styles.muted}>Trainer {ride.trainer?.fullName ?? 'chưa có'}</span><div className={styles.badges}><StatusBadge family="session" status={ride.status} /></div>
            <span className={preCheck(ride) === 'ALL_NORMAL' ? styles.toneSuccess : styles.toneWarning}>{preCheckText(ride)}</span></div></div>)}</div></Card>
      </div>
      <Card title="Lịch hôm nay"><div className="table-scroll"><DataTable<RiderSession> caption="Lịch hôm nay" rows={today} rowKey={(ride) => ride.id} empty={<EmptyState title="Hôm nay không có lượt cưỡi" description="Mở “Xem tất cả lịch phân công” để xem các ngày khác." />} columns={[
        { key: 'time', header: 'Thời gian', nowrap: true, render: (ride) => clock(ride.scheduledStart) },
        { key: 'horse', header: 'Ngựa', render: (ride) => <div className={styles.cellStack}><span className={styles.strong}>{ride.horse.name}</span><span className={styles.caption}>{ride.horse.horseCode}</span></div> },
        { key: 'session', header: 'Buổi tập', render: (ride) => ride.focus || ride.sessionCode },
        { key: 'trainer', header: 'Trainer', render: (ride) => ride.trainer?.fullName ?? 'Chưa cung cấp' },
        { key: 'status', header: 'Trạng thái', render: (ride) => <StatusBadge family="session" status={ride.status} /> },
        { key: 'open', header: 'Mở', render: (ride) => <Link className={styles.link} to={`/rider/assignments/${ride.id}`} aria-label={`Xem lịch phân công ${ride.sessionCode}`}><Icon name="chevron-right" size={16} /></Link> },
      ]} /></div></Card>
    </>}
  </div>;
}
export function RiderHistoryPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><HistoryTable api={api} /></RiderShell>;
}
