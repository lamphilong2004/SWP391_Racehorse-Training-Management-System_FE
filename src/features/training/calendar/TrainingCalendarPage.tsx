import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertBanner, Button, EmptyState, Icon, SelectField, StatusBadge, Tabs } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import type { CalendarSession, SupportingApi } from '../assigned/supportingApi';
import { SupportingReadState, SupportingShell } from '../assigned/SupportingShell';
import { useSupportingApi, useSupportingLoad } from '../assigned/supportingHooks';
import shared from '../assigned/supporting.module.css';
import { calendarPeriod, sameDay } from './calendarDates';
import { CALENDAR_HOUR_HEIGHT, CALENDAR_LANE_WIDTH, calendarLayout, type CalendarPlacement } from './calendarLayout';
import styles from './calendar.module.css';
import { viLabel } from '../../../shared/viLabels';

export function TrainingCalendarPage({ api: supplied }: { api?: SupportingApi }) {
  const api = useSupportingApi(supplied);
  return <SupportingShell title="Lịch" roles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><Calendar api={api} /></SupportingShell>;
}
function Calendar({ api }: { api: SupportingApi }) {
  const { user } = useAuth(); const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => new Date()); const [view, setView] = useState<'week' | 'month'>('week');
  const [horse, setHorse] = useState(''); const [program, setProgram] = useState(''); const [rider, setRider] = useState(''); const [status, setStatus] = useState('');
  const period = useMemo(() => calendarPeriod(anchor, view), [anchor, view]);
  const loaded = useSupportingLoad(() => api.sessions({ from: period.from, to: period.to }), [api, period.from, period.to]);
  const sessions = loaded.data ?? [];
  const shown = sessions.filter((session) => (!horse || String(session.horse.id) === horse) && (!program || String(session.programId) === program) && (!rider || String(session.workRider.id) === rider) && (!status || (status === 'BLOCKED' ? session.blocked : session.status === status)));
  const horses = [...new Map(sessions.map((item) => [item.horse.id, item.horse])).values()];
  const programs = [...new Set(sessions.map((item) => item.programId))]; const riders = [...new Map(sessions.map((item) => [item.workRider.id, item.workRider])).values()];
  function move(direction: number) { setAnchor((current) => { const next = new Date(current); if (view === 'month') { next.setDate(1); next.setMonth(next.getMonth() + direction); } else next.setDate(next.getDate() + 7 * direction); return next; }); }
  const starts = shown.map((session) => new Date(session.scheduledStart)).filter((date) => Number.isFinite(date.getTime()));
  const firstHour = Math.max(0, Math.min(6, ...starts.map((date) => date.getHours())));
  const lastHour = Math.min(24, Math.max(17, ...starts.map((date) => date.getHours() + 2)));
  const now = new Date(); const nowMinute = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const dayLayouts = period.days.map((day) => calendarLayout(shown.filter((session) => sameDay(new Date(session.scheduledStart), day))));
  const dayWidths = dayLayouts.map((entries) => Math.max(110, Math.max(1, ...entries.map((entry) => entry.lanes)) > 1 ? Math.max(...entries.map((entry) => entry.lanes)) * CALENDAR_LANE_WIDTH : 110));
  const weekStyle = { gridTemplateColumns: `56px ${dayWidths.map((width) => `minmax(${width}px, 1fr)`).join(' ')}`, minWidth: `${Math.max(870, 56 + dayWidths.reduce((total, width) => total + width, 0))}px` };
  const dayHeight = Math.max(hours.length * CALENDAR_HOUR_HEIGHT, ...dayLayouts.flatMap((entries) => entries.map((entry) => (entry.minute - firstHour * 60) / 60 * CALENDAR_HOUR_HEIGHT + entry.height)));
  function event(session: CalendarSession, placement?: CalendarPlacement) {
    const start = new Date(session.scheduledStart), month = !placement;
    return <button key={session.id} type="button" aria-label={`Mở ${session.sessionCode} ${session.horse.name}`} data-calendar-session={session.id} data-calendar-lane={placement?.lane} data-calendar-lanes={placement?.lanes} title={`${session.sessionCode} · ${start.toLocaleString('vi-VN')}${session.scheduledEnd ? ` – ${new Date(session.scheduledEnd).toLocaleString('vi-VN')}` : ''}`} className={`${styles.event} ${month ? styles.monthEvent : ''} ${session.blocked ? styles.blocked : session.status === 'COMPLETED' ? styles.completed : session.status === 'INTERRUPTED' ? styles.interrupted : ''}`} style={!placement ? undefined : { top: `${(placement.minute - firstHour * 60) / 60 * CALENDAR_HOUR_HEIGHT}px`, height: `${placement.height}px`, left: `calc(${placement.lane / placement.lanes * 100}% + 3px)`, width: `calc(${100 / placement.lanes}% - 6px)` }} onClick={() => navigate(`/training/session/${session.id}`)}><strong>{session.horse.name}</strong><span>{session.phaseName}</span><span>{session.workRider.fullName}</span><span>{session.blocked ? 'BLOCKED' : session.status.replaceAll('_', ' ')}</span><span>{start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></button>;
  }
  const label = view === 'month' ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : `${period.days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${period.days.at(-1)!.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return <div className={shared.stack}><div className={shared.header}><div><h1 className={shared.title}>Lịch tập</h1><p className={shared.muted}>{user?.roles.includes('TRAINER') ? 'Lên lịch và xem lại buổi tập cho các chương trình được giao.' : 'Xem lịch tập. Việc lên kế hoạch buổi tập thuộc về Trainer được phân công.'}</p></div>{user?.roles.includes('TRAINER') && <Link className={shared.primaryLink} to="/training/schedule/session/new">+ Tạo buổi tập</Link>}</div>
    <div className={styles.toolbar}><div className={styles.tools}><Button variant="secondary" size="sm" aria-label={`${view === 'week' ? 'Tuần' : 'Tháng'} trước`} onClick={() => move(-1)}><Icon className={styles.previous} name="chevron-right" size={16} /></Button><span className={styles.range}>{label}</span><Button variant="secondary" size="sm" aria-label={`${view === 'week' ? 'Tuần' : 'Tháng'} sau`} onClick={() => move(1)}><Icon name="chevron-right" size={16} /></Button><Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())}>Hôm nay</Button><Tabs label="Chế độ xem lịch" value={view} onChange={(next) => setView(next as 'week' | 'month')} items={[{ value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }]} /></div>
    <div className={styles.filters}><SelectField label="Ngựa" value={horse} onChange={(event) => setHorse(event.target.value)} options={[{ value: '', label: 'Tất cả' }, ...horses.map((item) => ({ value: String(item.id), label: item.name }))]} /><SelectField label="Chương trình" value={program} onChange={(event) => setProgram(event.target.value)} options={[{ value: '', label: 'Tất cả' }, ...programs.map((id) => ({ value: String(id), label: `Chương trình #${id}` }))]} /><SelectField label="Work Rider" value={rider} onChange={(event) => setRider(event.target.value)} options={[{ value: '', label: 'Tất cả' }, ...riders.map((item) => ({ value: String(item.id), label: item.fullName }))]} /><SelectField label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: '', label: 'Tất cả' }, ...['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED', 'BLOCKED'].map((value) => ({ value, label: viLabel(value) }))]} /></div></div>
    <SupportingReadState loading={!loaded.data} error={loaded.error} retry={loaded.retry} />
    {loaded.data && <>{shown.length === 0 && <EmptyState title="Không có buổi tập nào trong lựa chọn này" description="Đổi khoảng thời gian hoặc bộ lọc để xem buổi tập khác." />}<div className={styles.calendar}>{view === 'week' ? <><div className={styles.weekHead} style={weekStyle}><span />{period.days.map((day) => <div key={day.toISOString()} className={`${styles.dayHead} ${sameDay(day, new Date()) ? styles.today : ''}`}>{day.toLocaleDateString(undefined, { weekday: 'short' })}<strong>{day.getDate()}</strong></div>)}</div><div className={styles.weekBody} style={weekStyle}><div className={styles.hours}>{hours.map((hour) => <div key={hour} className={styles.hour}>{String(hour).padStart(2, '0')}:00</div>)}</div>{period.days.map((day, index) => <div key={day.toISOString()} className={`${styles.day} ${sameDay(day, new Date()) ? styles.today : ''}`} style={{ height: `${dayHeight}px` }} aria-label={day.toDateString()}>{sameDay(day, now) && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60 && <span className={styles.nowLine} style={{ top: `${(nowMinute - firstHour * 60) / 60 * CALENDAR_HOUR_HEIGHT}px` }} role="presentation" data-calendar-now />}{dayLayouts[index].map((placement) => event(placement.session, placement))}</div>)}</div></> : <div className={styles.month}>{period.days.map((day) => <div key={day.toISOString()} className={`${styles.monthDay} ${day.getMonth() !== anchor.getMonth() ? styles.outside : ''} ${sameDay(day, new Date()) ? styles.today : ''}`}><strong>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>{shown.filter((session) => sameDay(new Date(session.scheduledStart), day)).map((session) => event(session))}</div>)}</div>}</div></>}
    <div className={styles.legend}>{(['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED'] as const).map((item) => <StatusBadge key={item} family="session" status={item} />)}<span>Bị chặn: cần chuẩn bị trước khi buổi tập có thể bắt đầu.</span></div><AlertBanner type="info" title="Hạn chế tập luyện của Veterinarian">Ngựa bị Khóa không thể lên lịch hay bắt đầu. Ngựa Hạn chế cần kiểm tra từng bài tập khi lên lịch. Lịch hiển thị trạng thái buổi tập và hạn chế y tế hiện tại.</AlertBanner>
  </div>;
}
