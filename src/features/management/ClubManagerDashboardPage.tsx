import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, MetricCard, StatusBadge, type StatusOf } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { AuditTable } from './AuditTable';
import { ManagementAccess } from './ManagementAccess';
import { ManagementContext } from './ManagementProvider';
import { useManagementResource } from './useManagementResource';
import type { CountByKey } from './types';
import styles from './Management.module.css';

const total = (rows: CountByKey[]) => rows.reduce((sum, row) => sum + row.count, 0);
const count = (rows: CountByKey[], key: string) => rows.find((row) => row.key === key)?.count ?? 0;
const label = (key: string) => key.replaceAll('_', ' ').toLowerCase();

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
  const navigate = useNavigate();
  const service = useContext(ManagementContext);
  const [revision, setRevision] = useState(0);
  const resource = useManagementResource(service.dashboard, revision);
  const data = resource.status === 'ready' ? resource.data : null;
  return <AppShell user={{ fullName: auth.user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Dashboard' }]}>
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><h1 className="text-h1">Club Manager Dashboard</h1><p className={styles.subtitle}>Management overview · Core modules · Read-only summary</p></div>
        <div className={styles.actions}><Link className={styles.linkButton} to={ROUTES.auditLog}><Icon name="history" size={16} /> View Audit Log</Link><Button variant="secondary" disabled={resource.status === 'loading'} onClick={() => setRevision((value) => value + 1)}>Refresh</Button><Button variant="tertiary" onClick={() => { void auth.logout().then(() => navigate(ROUTES.login, { replace: true })); }}>Sign out</Button></div>
      </header>
      {resource.status === 'loading' && <LoadingState label="Loading management overview…" />}
      {resource.status === 'error' && <ErrorState title={resource.forbidden ? 'Access denied' : 'Dashboard unavailable'} description={resource.message} onRetry={resource.forbidden ? undefined : () => setRevision((value) => value + 1)} />}
      {data && <>
        <div className={styles.metrics}>
          <MetricCard label="Horses" value={total(data.horsesByLifecycle).toLocaleString()} caption={`${count(data.horsesByLifecycle, 'ACTIVE')} active · ${count(data.horsesByLifecycle, 'DRAFT')} draft · ${count(data.horsesByLifecycle, 'INACTIVE')} inactive`} />
          <MetricCard label="Pending activation" value={String(data.needsAttention.pendingActivations)} caption="Draft horses awaiting activation" captionTone="warning" captionIcon="clock" />
          <MetricCard label="Stable occupancy" value={`${data.boxOccupancy.occupied} / ${data.boxOccupancy.total}`} caption={`${data.boxOccupancy.free} free boxes`} />
          <MetricCard label="Staff & users" value={total(data.accountsByStatus).toLocaleString()} caption={`${count(data.accountsByStatus, 'ACTIVE')} active · ${count(data.accountsByStatus, 'INACTIVE')} inactive`} />
        </div>
        <div className={styles.twoColumns}>
          <Card title="Horses by status">
            <div className={styles.statusGroup}><h4 className={styles.overline}>Lifecycle</h4><Breakdown rows={data.horsesByLifecycle} family="lifecycle" empty="No horses registered" /></div>
            <div className={styles.statusGroup}><h4 className={styles.overline}>Availability · active horses only</h4><Breakdown rows={data.horsesByAvailability} family="availability" empty="No active horse availability" /></div>
            <p className={styles.note}>Availability is derived from active medical restrictions. Clinical details are restricted to medical roles.</p>
          </Card>
          <Card title="Needs attention">
            <dl className={styles.stats}>
              <div><dt>Pending horse activations</dt><dd>{data.needsAttention.pendingActivations}</dd></div>
              <div><dt>Pending registrations</dt><dd>{data.needsAttention.pendingRegistrations}</dd></div>
              <div><dt>Open incidents</dt><dd>{data.openIncidents}</dd></div>
            </dl>
            {data.needsAttention.pendingActivations + data.needsAttention.pendingRegistrations + data.openIncidents === 0 && <EmptyState title="Nothing needs attention" />}
            <p className={styles.note}>Open incidents include reported and under-review records.</p>
          </Card>
        </div>
        <div className={styles.threeColumns}>
          <Card title="Training today"><p className={styles.number}>{total(data.trainingToday.byStatus)} <span className={styles.note}>scheduled sessions</span></p><Breakdown rows={data.trainingToday.byStatus} empty="No sessions scheduled today" /></Card>
          <Card title="Incidents"><p className={styles.number}>{data.openIncidents}</p><p className={styles.subtitle}>Reported or under review</p><p className={styles.note}>Management summary only.</p></Card>
          <Card title="Stable boxes"><dl className={styles.stats}><div><dt>Total boxes</dt><dd>{data.boxOccupancy.total}</dd></div><div><dt>Occupied</dt><dd>{data.boxOccupancy.occupied}</dd></div><div><dt>Free</dt><dd>{data.boxOccupancy.free}</dd></div></dl></Card>
        </div>
        <Card title="Recent audit activity" action={<Link to={ROUTES.auditLog}>View all audit records</Link>}>
          {data.recentAudit.length ? <AuditTable compact entries={data.recentAudit} caption="Recent audit activity, newest first" /> : <EmptyState title="No recent audit activity" description="System activity will appear here when records are available." />}
        </Card>
      </>}
    </div>
  </AppShell>;
}

export function ClubManagerDashboardPage() { return <ManagementAccess><DashboardContent /></ManagementAccess>; }
