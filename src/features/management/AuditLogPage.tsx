import { useCallback, useContext, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, Card, ErrorState, LoadingState, SelectField, TextField } from '../../design-system';
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
  return <Card className={styles.auditCard}>
    <AuditTable entries={entries} emptyTitle={data.totalItems === 0 ? 'No audit records match these filters' : 'No records on this page match'} />
    <footer className={styles.pagination}>
      <p aria-live="polite">{search || role ? `${entries.length} visible on this page · ` : ''}Showing {start}–{end} of {data.totalItems} records</p>
      <div className={styles.actions}>
        <SelectField className={styles.pageSize} label="Records per page" value={String(query.size)} options={[...new Set([10, 20, 50, 100, query.size])].sort((a, b) => a - b).map((size) => ({ value: String(size), label: String(size) }))} onChange={(event) => { const next = new URLSearchParams(params); next.set('size', event.target.value); next.set('page', '0'); setParams(next); }} />
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
  const [datesOpen, setDatesOpen] = useState(Boolean(errors.from || errors.to));
  const queryErrors = validateAuditQuery(query);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = queryFromFilters(filters, query.size);
    const validation = validateAuditQuery(next);
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (validation.from || validation.to) setDatesOpen(true);
      return;
    }
    const nextParams = auditSearchParams(next);
    if (pageSearch.trim()) nextParams.set('pageSearch', pageSearch.trim());
    if (role) nextParams.set('pageRole', role);
    setParams(nextParams);
  };
  const field = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(filtersFromQuery({ page: 0, size: 20 })); setErrors({}); setPageSearch(''); setRole(''); setDatesOpen(false); setParams({}); };
  return <AppShell user={{ fullName: user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Administration' }, { label: 'Audit Log' }]} searchPlaceholder="Search audit log…">
    <div className={styles.page}>
      <Link to={ROUTES.dashboard} className={styles.back}>← Dashboard</Link>
      <header className={styles.heading}><div><h1 className="text-h1">Audit Log <span className={styles.readOnly}>Read-only</span></h1><p className={styles.subtitle}>Who did what, and when · written automatically by the system · newest first</p></div></header>
      <AlertBanner type="info" title="Audit records are historical — they cannot be created, edited or deleted">
        Records remain available for deactivated accounts. Entries are written automatically when people act in the system. Passwords, hashes, tokens and secrets must never be included in audit records.
      </AlertBanner>
        <form className={styles.filters} onSubmit={apply} noValidate>
          <TextField className={`${styles.compactField} ${styles.searchField}`} label="Search this page" title="Search actor, action or ID on the current page only" type="search" placeholder="Search actor, action or ID…" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} />
          <TextField className={`${styles.compactField} ${styles.actorField}`} label="Actor ID" title="Actor user ID · all records" inputMode="numeric" placeholder="Actor ID: All" value={filters.actor} error={errors.actor} onChange={(event) => field('actor', event.target.value)} />
          <SelectField className={`${styles.compactField} ${styles.roleField}`} label="Role on this page" title="Role filter applies to the current page only" placeholder="Role: All · page" value={role} options={ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))} onChange={(event) => setRole(event.target.value)} />
          <TextField className={`${styles.compactField} ${styles.codeField}`} label="Action" title="Exact action code · all records" placeholder="Action: All" maxLength={100} value={filters.action} error={errors.action} onChange={(event) => field('action', event.target.value)} />
          <TextField className={`${styles.compactField} ${styles.codeField}`} label="Entity type" title="Exact entity type · all records" placeholder="Entity: All" maxLength={50} value={filters.targetType} error={errors.targetType} onChange={(event) => field('targetType', event.target.value)} />
          <details className={styles.dateFilter} open={datesOpen} onToggle={(event) => setDatesOpen(event.currentTarget.open)} onKeyDown={(event) => { if (event.key === 'Escape') { setDatesOpen(false); event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary>Date: {filters.from || filters.to ? `${filters.from.slice(0, 10) || 'Any start'} – ${filters.to.slice(0, 10) || 'Any end'}` : 'All'}</summary>
            <div className={styles.datePopover}>
              <TextField label="From (local time)" type="datetime-local" value={filters.from} error={errors.from} onInput={(event) => field('from', event.currentTarget.value)} onChange={(event) => field('from', event.target.value)} />
              <TextField label="To (local time)" type="datetime-local" value={filters.to} error={errors.to} onInput={(event) => field('to', event.currentTarget.value)} onChange={(event) => field('to', event.target.value)} />
              <p className={styles.note}>Enter local time. The selected range is sent as UTC when you apply filters.</p>
              <Button variant="secondary" size="sm" onClick={() => setDatesOpen(false)}>Close date filter</Button>
            </div>
          </details>
          <div className={styles.filterActions}><Button type="submit" size="sm">Apply filters</Button><Button variant="secondary" type="button" size="sm" onClick={reset}>Reset filters</Button></div>
          <p className={styles.filterNote}>Actor, action, entity and date filters search all records. Search and role filter the current page only. Dates are entered in your local time and sent as UTC.</p>
        </form>
      {(errors.page || queryErrors.page) && <ErrorState title="Invalid page" description={errors.page ?? queryErrors.page} />}
      {(errors.size || queryErrors.size) && <ErrorState title="Invalid page size" description={errors.size ?? queryErrors.size} />}
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
