import { useCallback, useEffect, useState } from 'react';
import { ButtonLink, Card, ErrorState, Icon, LoadingState, MetricCard } from '../../design-system';
import { ROUTES } from '../../app/routePaths';
import { clubDateTime } from '../../shared/clubCalendar';
import { useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { comparePhase, instructionText, slotTime, summarize, taskPhase } from './careTaskPhase';
import type { StockItem, Task } from './stableCareApi';
import styles from './careToday.module.css';

const TASK_LABELS: Record<string, string> = { CLEANING: 'Vệ sinh chuồng', FEEDING: 'Cho ăn', BATHING: 'Tắm', LEG_SOAKING: 'Chăm sóc chân', OTHER: 'Khác' };

function listOrFail<T>(value: T[]): T[] {
  if (!Array.isArray(value)) throw new Error('Dữ liệu công việc trả về không đúng định dạng.');
  return value;
}

/**
 * Vietnam club clock that keeps moving while the dashboard stays open: tasks cross into "overdue" without a reload,
 * and a new club day changes `date`, which reloads that day's tasks. Same-minute ticks do not re-render.
 */
function useClubClock(intervalMs = 30_000) {
  const [now, setNow] = useState(() => clubDateTime());
  useEffect(() => {
    const tick = () => setNow(clubDateTime());
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const timer = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [intervalMs]);
  return now;
}

/** Flow 4 step 4.4 at a glance: today's care progress for the Groom (own tasks) or the Club Manager (whole stable). */
export function CareTodayPanel({ manager }: { manager: boolean }) {
  const request = useFlowRequest();
  const clubNow = useClubClock(); const date = clubNow.slice(0, 10);
  const load = useCallback((signal: AbortSignal) => request<Task[]>(`/api/stable-care/tasks?date=${date}`, { signal }).then(listOrFail), [request, date]);
  const tasks = useResource(load);
  const counts = tasks.data ? summarize(tasks.data, date, clubNow) : null;
  const overdue = (tasks.data ?? []).map(task => ({ ...task, phase: taskPhase(task, date, clubNow) })).filter(task => task.phase === 'overdue').sort(comparePhase);
  return <section className={styles.panel} aria-labelledby="care-today-title">
    <div className={styles.heading}><div><h2 id="care-today-title">Chăm sóc hôm nay</h2><p>{manager ? 'Tiến độ chăm sóc và cho ăn của cả chuồng hôm nay, theo giờ Việt Nam.' : 'Việc chăm sóc và cho ăn được giao cho bạn hôm nay.'}</p></div>
      <div className={styles.actions}><ButtonLink variant="primary" to={ROUTES.dailyCare}>Mở chăm sóc hằng ngày<Icon name="chevron-right" size={16} /></ButtonLink></div></div>
    {tasks.pending && <LoadingState label="Đang tải công việc hôm nay…" />}
    {tasks.error && <ErrorState title="Không tải được công việc hôm nay" description={tasks.error} onRetry={tasks.reload} />}
    {counts && <div className={styles.metrics}>
      <MetricCard label="Tổng công việc" value={String(counts.total)} caption={manager ? 'Toàn bộ chuồng' : 'Được giao cho bạn'} />
      <MetricCard label="Còn lại" value={String(counts.pending)} caption="Chưa hoàn thành, chưa hủy" captionTone="warning" />
      <MetricCard label="Quá giờ" value={String(counts.overdue)} caption={counts.overdue ? 'Cần xử lý ngay' : 'Không có việc trễ'} captionTone={counts.overdue ? 'danger' : 'success'} />
      <MetricCard label="Đã hoàn thành" value={`${counts.done}/${counts.total - counts.cancelled}`} caption="Có người và giờ thực hiện" captionTone="success" />
    </div>}
    {counts && overdue.length > 0 && <Card><h3 className={styles.listTitle}>Việc quá giờ</h3><ul className={styles.list}>{overdue.slice(0, 5).map(task => <li key={task.id}>
      <span className={styles.slot}>{slotTime(task.slot) ?? task.slot}</span>
      <span><strong>{task.horseName}</strong> · {TASK_LABELS[task.taskType] ?? task.taskType}<small>{instructionText(task.instructions)}</small></span>
      {manager && <span className={styles.owner}>{task.groomName}</span>}
    </li>)}</ul>{overdue.length > 5 && <p className={styles.more}>Còn {overdue.length - 5} việc quá giờ khác trong Chăm sóc hằng ngày.</p>}</Card>}
    {counts && counts.total === 0 && <p className={styles.more}>{manager ? 'Hôm nay chưa có công việc. Lập kế hoạch chăm sóc hoặc dinh dưỡng để giao việc cho Groom.' : 'Hôm nay bạn chưa được giao công việc chăm sóc nào.'}</p>}
    {manager && <LowStock />}
  </section>;
}

function LowStock() {
  const request = useFlowRequest();
  const load = useCallback((signal: AbortSignal) => request<StockItem[]>('/api/stable-care/inventory', { signal }).then(listOrFail), [request]);
  const stock = useResource(load);
  if (!stock.data) return null;
  const low = stock.data.filter(item => item.active && item.threshold !== null && item.currentQuantity <= item.threshold);
  return <p className={styles.stock} data-low={low.length > 0 || undefined}><Icon name="package" size={16} />{low.length ? `${low.length} vật tư đang ở mức bằng hoặc dưới ngưỡng nhắc: ${low.slice(0, 3).map(item => item.name).join(', ')}${low.length > 3 ? '…' : ''}.` : 'Tất cả vật tư đang dùng đều trên ngưỡng nhắc.'} <ButtonLink variant="tertiary" size="sm" to={ROUTES.inventory}>Mở kho</ButtonLink></p>;
}
