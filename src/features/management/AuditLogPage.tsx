import { useCallback, useContext, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, Card, ErrorState, Icon, LoadingState, SelectField, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS } from '../../shared/auth/roles';
import { AuditTable } from './AuditTable';
import { auditSearchParams, filtersFromQuery, queryFromFilters, readAuditQuery, validateAuditQuery, type AuditFilterErrors } from './auditQuery';
import { ManagementAccess } from './ManagementAccess';
import { ManagementContext } from './ManagementProvider';
import { useManagementResource } from './useManagementResource';
import type { AuditQuery } from './types';
import styles from './Management.module.css';

function AuditResults({ query, pageSearch, role }: { query: AuditQuery; pageSearch: string; role: string }) {
  const service = useContext(ManagementContext);
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const load = useCallback((context: Parameters<typeof service.audit>[1]) => service.audit(query, context), [service, query]);
  const resource = useManagementResource(load, revision);
  if (resource.status === 'loading') return <LoadingState label="Loading audit records…" />;
  if (resource.status === 'error') return <ErrorState title={resource.forbidden ? 'Access denied' : 'Audit log unavailable'} description={resource.message} onRetry={resource.forbidden ? undefined : () => setRevision((value) => value + 1)} />;
  const data = resource.data;
  const search = pageSearch.trim().toLocaleLowerCase();
  const entries = data.items.filter((entry) => (!role || entry.actorRole === role) && (!search || [entry.actor?.fullName, entry.actor?.userCode, entry.actor?.id, entry.action, entry.targetType, entry.targetId, entry.id].some((value) => value != null && String(value).toLocaleLowerCase().includes(search))));
  const navigatePage = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  };
  const start = data.items.length ? data.page * data.size + 1 : 0;
  const end = data.items.length ? data.page * data.size + data.items.length : 0;
  return <Card>
    <AuditTable entries={entries} emptyTitle={data.totalItems === 0 ? 'No audit records match these filters' : 'No records on this page match'} />
    <footer className={styles.pagination}>
      <p aria-live="polite">{search || role ? `${entries.length} visible on this page · ` : ''}Showing {start}–{end} of {data.totalItems} records</p>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}>Refresh records</Button>
        {data.items.length === 0 && data.page > 0 && <Button variant="secondary" size="sm" onClick={() => navigatePage(0)}>First page</Button>}
        <Button variant="secondary" size="sm" disabled={data.page <= 0} onClick={() => navigatePage(data.page - 1)}>Previous</Button>
        <span>{data.page > 0 && data.page >= data.totalPages ? 'This page is no longer available.' : `Page ${data.page + 1} of ${Math.max(1, data.totalPages)}`}</span>
        <Button variant="secondary" size="sm" disabled={data.page + 1 >= data.totalPages} onClick={() => navigatePage(data.page + 1)}>Next</Button>
      </div>
    </footer>
  </Card>;
}

function AuditContent({ query }: { query: AuditQuery }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromQuery(query));
  const [errors, setErrors] = useState<AuditFilterErrors>(() => validateAuditQuery(query));
  const [pageSearch, setPageSearch] = useState(params.get('pageSearch') ?? '');
  const [role, setRole] = useState(params.get('pageRole') ?? '');
  const queryErrors = validateAuditQuery(query);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = queryFromFilters(filters, query.size);
    const validation = validateAuditQuery(next);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const nextParams = auditSearchParams(next);
    if (pageSearch.trim()) nextParams.set('pageSearch', pageSearch.trim());
    if (role) nextParams.set('pageRole', role);
    setParams(nextParams);
  };
  const field = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  return <AppShell user={{ fullName: user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Administration' }, { label: 'Audit Log' }]}>
    <div className={styles.page}>
      <Link to={ROUTES.dashboard} className={styles.back}>← Back to Dashboard</Link>
      <header className={styles.heading}><div><h1 className="text-h1">Audit Log <span className={styles.readOnly}><Icon name="lock" size={14} /> Read-only</span></h1><p className={styles.subtitle}>Who did what, and when · Written automatically by the system · Newest first</p></div></header>
      <AlertBanner type="info" title="Audit records are historical — they cannot be created, edited or deleted">
        Records remain available for deactivated accounts. Passwords, hashes, tokens and secrets must never be included in audit records.
      </AlertBanner>
      <Card>
        <form className={styles.filters} onSubmit={apply} noValidate>
          <TextField label="Search this page" type="search" placeholder="Actor, action or ID…" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} />
          <TextField label="Actor ID" inputMode="numeric" placeholder="All actors" value={filters.actor} error={errors.actor} onChange={(event) => field('actor', event.target.value)} />
          <SelectField label="Role on this page" placeholder="All roles" value={role} options={ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))} onChange={(event) => setRole(event.target.value)} />
          <TextField label="Action" placeholder="Exact action code" maxLength={100} value={filters.action} error={errors.action} onChange={(event) => field('action', event.target.value)} />
          <TextField label="Entity type" placeholder="Exact entity type" maxLength={50} value={filters.targetType} error={errors.targetType} onChange={(event) => field('targetType', event.target.value)} />
          <TextField label="From (local time)" type="datetime-local" value={filters.from} error={errors.from} onChange={(event) => field('from', event.target.value)} />
          <TextField label="To (local time)" type="datetime-local" value={filters.to} error={errors.to} onChange={(event) => field('to', event.target.value)} />
          <SelectField label="Records per page" value={String(query.size)} options={[...new Set([10, 20, 50, 100, ...(Number.isInteger(query.size) && query.size >= 1 && query.size <= 100 ? [query.size] : [])])].sort((a, b) => a - b).map((size) => ({ value: String(size), label: String(size) }))} error={errors.size} onChange={(event) => { const next = new URLSearchParams(params); next.set('size', event.target.value); next.set('page', '0'); setParams(next); }} />
          <div className={styles.filterActions}><Button type="submit">Apply filters</Button><Button variant="secondary" type="button" onClick={() => { setFilters(filtersFromQuery({ page: 0, size: 20 })); setErrors({}); setPageSearch(''); setRole(''); setParams({}); }}>Reset filters</Button></div>
          <p className={styles.filterNote}>Actor, action, entity and date filters search all records. Search and role filter the current page only. Dates are entered in your local time and sent as UTC.</p>
        </form>
      </Card>
      {(errors.page || queryErrors.page) && <ErrorState title="Invalid page" description={errors.page ?? queryErrors.page} />}
      {!Object.keys(queryErrors).length && <AuditResults query={query} pageSearch={pageSearch} role={role} />}
      <p className={styles.note}>The audited action vocabulary is maintained by the backend (CORE-051). This viewer does not create or modify records.</p>
    </div>
  </AppShell>;
}

function AuditRouteContent() {
  const [params] = useSearchParams();
  // URL-backed server filters survive reload/back. Remounting clears old page data before loading new filters.
  return <AuditContent key={params.toString()} query={readAuditQuery(params)} />;
}

export function AuditLogPage() { return <ManagementAccess><AuditRouteContent /></ManagementAccess>; }
