import { useContext, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { Card, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge, type StatusOf } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { RecentAudit } from './RecentAudit';
import { ManagementShortcuts } from './ManagementShortcuts';
import { ManagementAccess } from './ManagementAccess';
import { ManagementContext, ManagementDestinationsContext } from './ManagementProvider';
import { useManagementResource } from './useManagementResource';
import type { CountByKey } from './types';
import styles from './Management.module.css';
import { businessDataMode } from '../../shared/data/businessData';

const total = (rows: CountByKey[]) => rows.reduce((sum, row) => sum + row.count, 0);
const count = (rows: CountByKey[], key: string) => rows.find((row) => row.key === key)?.count ?? 0;
const label = (key: string) => key.replaceAll('_', ' ').toLowerCase();
// Existing CM-guarded route in the FE integration harness; do not add shared routes here.
const pendingActivationPath = `${ROUTES.horses}/pending-activation`;

function Breakdown({ rows, empty, family }: { rows: CountByKey[]; empty: string; family?: 'lifecycle' | 'availability' }) {
  const sum = total(rows);
  if (!sum) return <EmptyState title={empty} />;
  return <div className={styles.breakdown}>
    <div className={styles.bar} aria-hidden="true">{rows.filter((row) => row.count > 0).map((row) => <span key={row.key} data-tone={family ? row.key : undefined} style={{ flex: row.count }} />)}</div>
    <dl className={family ? styles.legend : styles.stats}>{rows.map((row) => <div key={row.key}><dt>{family === 'lifecycle' && ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(row.key) ? <StatusBadge family="lifecycle" status={row.key as StatusOf<'lifecycle'>} /> : family === 'availability' && ['AVAILABLE', 'LIMITED', 'LOCKED'].includes(row.key) ? <StatusBadge family="availability" status={row.key as StatusOf<'availability'>} /> : label(row.key)}</dt><dd>{row.count.toLocaleString()}</dd></div>)}</dl>
  </div>;
}

function DashboardContent() {
  const auth = useAuth();
  const destinations = useContext(ManagementDestinationsContext);
  const [localTime] = useState(() => new Date());
  const service = useContext(ManagementContext);
  const [revision, setRevision] = useState(0);
  const resource = useManagementResource(service.dashboard, revision);
  const data = resource.status === 'ready' ? resource.data : null;
  return <AppShell designSystem="v2" user={{ fullName: auth.user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Dashboard' }, { label: 'Club overview' }]} searchPlaceholder="Search horses, users…">
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.title}><h1 className="text-h1">Club Manager Dashboard</h1><p className={styles.subtitle}>Management overview · <time dateTime={localTime.toISOString()} title="Current local time, not a data refresh timestamp">{new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(localTime)}</time> · summaries from each module — open a module to make changes</p></div>
        <div className={styles.actions}><Link className={styles.linkButton} to={ROUTES.auditLog}>View Audit Log</Link>{destinations.registerHorse === '/horses/new' && <Link className={`${styles.linkButton} ${styles.primaryLink}`} to={destinations.registerHorse}>+ Register Horse</Link>}</div>
      </header>
      {businessDataMode() === 'sample' && <p className={styles.note}>Sample overview uses the shared horse, session and incident data. Accounts represent seven sample roles; registrations are not modeled. Recent entries are sample snapshots, not backend audit events.</p>}
      {resource.status === 'loading' && <LoadingState label="Loading management overview…" />}
      {resource.status === 'error' && <ErrorState title={resource.forbidden ? 'Access denied' : 'Dashboard unavailable'} description={resource.message} onRetry={resource.forbidden ? undefined : () => setRevision((value) => value + 1)} />}
      {data && <>
        <div className={styles.metrics}>
          <Link className={styles.metricLink} to={ROUTES.horses} aria-label="View horses"><MetricCard label="Horses" value={total(data.horsesByLifecycle).toLocaleString()} caption={`${count(data.horsesByLifecycle, 'ACTIVE')} ACTIVE · ${count(data.horsesByLifecycle, 'DRAFT')} DRAFT · ${count(data.horsesByLifecycle, 'INACTIVE')} INACTIVE`} /></Link>
          <Link className={styles.metricLink} to={pendingActivationPath} aria-label="View pending activations"><MetricCard label="Pending activation" value={String(data.needsAttention.pendingActivations)} caption="Draft horses awaiting activation" /></Link>
          <MetricCard label="Stable occupancy" value={`${data.boxOccupancy.occupied} / ${data.boxOccupancy.total}`} caption={`${data.boxOccupancy.free} free boxes`} />
          <MetricCard label="Staff & user accounts" value={total(data.accountsByStatus).toLocaleString()} caption={`${count(data.accountsByStatus, 'ACTIVE')} active · ${count(data.accountsByStatus, 'INACTIVE')} inactive`} />
        </div>
        <div className={styles.twoColumns}>
          <Card title="Horses by status" className={styles.figmaCard}>
            <div className={styles.statusGroup}><h4 className={styles.overline}>Lifecycle</h4><Breakdown rows={data.horsesByLifecycle} family="lifecycle" empty="No horses registered" /></div>
            <div className={styles.statusGroup}><h4 className={styles.overline}>Training availability (set by the Veterinarian — read-only here)</h4><Breakdown rows={data.horsesByAvailability} family="availability" empty="No active horse availability" /></div>
            <p className={styles.note}>Counts cover the {total(data.horsesByLifecycle)} horses in the club register. Health Status and Training Availability are always shown separately from lifecycle. Availability counts cover ACTIVE horses only.</p>
          </Card>
          <Card title="Needs attention" className={styles.figmaCard}>
            <dl className={styles.stats}>
              <div><dt><Link to={pendingActivationPath}>Pending horse activations</Link></dt><dd>{data.needsAttention.pendingActivations}</dd></div>
              <div><dt>Pending registrations</dt><dd>{data.needsAttention.pendingRegistrations}</dd></div>
              <div><dt><Link to={ROUTES.incidents}>Open incidents</Link></dt><dd>{data.openIncidents}</dd></div>
            </dl>
            {data.needsAttention.pendingActivations + data.needsAttention.pendingRegistrations + data.openIncidents === 0 && <EmptyState title="Nothing needs attention" />}
            <p className={styles.note}>Open incidents include reported and under-review records.</p>
          </Card>
        </div>
        <div className={styles.threeColumns}>
          <Card title="Training today" className={styles.figmaCard}><p className={styles.number}>{total(data.trainingToday.byStatus)} <span className={styles.note}>{total(data.trainingToday.byStatus) === 1 ? 'scheduled session' : 'scheduled sessions'}</span></p><Breakdown rows={data.trainingToday.byStatus} empty="No sessions scheduled today" /></Card>
          <Card title="Incidents" className={styles.figmaCard} action={<Link to={ROUTES.incidents}>View Incidents →</Link>}><p className={styles.number}>{data.openIncidents}</p><p className={styles.subtitle}>Reported or under review</p><p className={styles.note}>Management summary only.</p></Card>
          <Card title="Stable boxes" className={styles.figmaCard}><dl className={styles.stats}><div><dt>Total boxes</dt><dd>{data.boxOccupancy.total}</dd></div><div><dt>Occupied</dt><dd>{data.boxOccupancy.occupied}</dd></div><div><dt>Free</dt><dd>{data.boxOccupancy.free}</dd></div></dl></Card>
        </div>
        <div className={styles.auditAndShortcuts}>
          <Card title="Recent audit activity" className={styles.figmaCard} action={<Link to={ROUTES.auditLog}>View Audit Log →</Link>}>
            <RecentAudit entries={data.recentAudit} />
            <p className={styles.note}>Written automatically by the system · read-only</p>
          </Card>
          <ManagementShortcuts />
        </div>
      </>}
    </div>
  </AppShell>;
}

export function ClubManagerDashboardPage() { return <ManagementAccess><DashboardContent /></ManagementAccess>; }
