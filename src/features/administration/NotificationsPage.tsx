import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, ButtonLink, Card, Drawer, EmptyState, ErrorState, LoadingState, NotificationItem, SelectField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RoleCode } from '../../shared/auth/roles';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage } from '../main-flows/api';
import { useNotifications } from '../../shared/notifications/NotificationsProvider';
import { useResource } from '../main-flows/useResource';
import type { Page } from './accountApi';
import styles from './Administration.module.css';

interface Notice { id: number; category: 'ALERTS' | 'MEDICAL' | 'SCHEDULE'; notificationType: string; title: string; message: string; readAt: string | null; targetType: string | null; targetId: number | null; isSimulated: boolean; createdAt: string }
/** Fixed local routes only; never navigate to a URL supplied by notification content. The target retains its own RBAC. */
function destination(notice: Notice, roles: RoleCode[]): string | undefined {
  const id = notice.targetId;
  if (!id || !Number.isSafeInteger(id) || id < 1) return undefined;
  if (notice.targetType === 'HORSE') return roles.includes('HORSE_OWNER') ? `/owner/horses/${id}` : `/horses/${id}`;
  if (notice.targetType === 'TRAINING_SESSION') {
    if (roles.includes('WORK_RIDER')) return `/rider/assignments/${id}`;
    if (roles.includes('GROOM')) return `/training/my-sessions/${id}/pre-check`;
    if (roles.some((r) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'].includes(r))) return `/training/session/${id}`;
  }
  if (notice.targetType === 'INCIDENT' && !roles.includes('HORSE_OWNER')) return `/incidents/${id}`;
  if (notice.targetType === 'MEDICAL_CASE' && roles.some((r) => ['VETERINARIAN', 'TRAINER', 'HEAD_TRAINER', 'CLUB_MANAGER'].includes(r))) return `/medical/cases/${id}`;
  if (notice.targetType === 'CARE_TASK' && roles.includes('GROOM')) return '/care/tasks';
  if (notice.targetType === 'HORSE_TRAINING_PROGRAM' && roles.some((r) => ['HEAD_TRAINER', 'TRAINER'].includes(r))) return `/training/programs/${id}`;
  return undefined;
}
export function NotificationsPage() {
  const { user } = useAuth();
  return user ? <NotificationContent key={user.id} role={user.roles[0]} roles={user.roles} /> : null;
}
export function NotificationDrawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  return user ? <Drawer open title="Notifications" onClose={onClose} footer={<ButtonLink to="/notifications" onClick={onClose}>View all notifications</ButtonLink>}>
    <NotificationContent key={user.id} role={user.roles[0]} roles={user.roles} compact />
  </Drawer> : null;
}
function NotificationContent({ role, roles, compact = false }: { role: RoleCode; roles: RoleCode[]; compact?: boolean }) {
  const notifications = useNotifications();
  const request = notifications?.request;
  const revision = notifications?.revision;
  const [category, setCategory] = useState(''), [read, setRead] = useState(''), [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const inFlight = useRef(false);
  const load = useMemo(() => async (signal: AbortSignal) => {
    const query = new URLSearchParams({ ...(category ? { category } : {}), ...(read ? { read } : {}), page: String(page), size: '20' });
    if (!request || revision === undefined) throw new Error('Sign in again to access notifications.');
    return request<Page<Notice>>(`/api/notifications?${query}`, { signal });
  }, [request, category, read, page, revision]);
  const resource = useResource(load);
  async function mark(id?: number) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
    try { if (!notifications) throw new Error('Sign in again to access notifications.'); await notifications.markRead(id); }
    catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  const content = <div className={styles.stack}><Button variant="secondary" disabled={busy || !notifications?.unreadCount} onClick={() => { void mark(); }}>Mark all as read</Button><div className={styles.filters}>
      <SelectField label="Read state" value={read} options={[{ value: '', label: 'All' }, { value: 'false', label: 'Unread' }, { value: 'true', label: 'Read' }]} onChange={(e) => { setRead(e.target.value); setPage(0); }} />
      <SelectField label="Type" value={category} options={[{ value: '', label: 'All types' }, { value: 'ALERTS', label: 'Alerts' }, { value: 'MEDICAL', label: 'Medical' }, { value: 'SCHEDULE', label: 'Schedule' }]} onChange={(e) => { setCategory(e.target.value); setPage(0); }} />
      {notifications?.unreadCount !== undefined && <span>{notifications.unreadCount} unread</span>}
    </div>
    {notifications?.error && <ErrorState title="Unread count unavailable" description={notifications.error} onRetry={() => { void notifications.refresh(); }} />}
    {error && <AlertBanner type="danger" title="Notification update failed">{error}</AlertBanner>}
    {resource.pending && <LoadingState label="Loading notifications…" />}{resource.error && <ErrorState title="Notifications unavailable" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <><Card>{resource.data.items.length === 0 && <EmptyState title="No matching notifications" />}
      {resource.data.items.map((notice) => { const target = destination(notice, roles); return <div key={notice.id} className={styles.row}>
        <NotificationItem title={notice.title} body={notice.message} context={`${notice.category}${notice.isSimulated ? ' · SIMULATED DATA' : ''}`} time={new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notice.createdAt))} read={notice.readAt !== null} />
        <div className={styles.actions}>{!notice.readAt && <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void mark(notice.id); }}>Mark as read</Button>}{target && <Link to={target}>Open</Link>}</div>
      </div>; })}</Card><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {resource.data.totalItems} notifications</span><Button variant="secondary" disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></>}
    </div>;
  return compact ? content : <FlowShell title="Notifications" section="Workspace" role={role} description="In-app notifications for your account. Opening one never changes business records or permissions.">{content}</FlowShell>;
}
