import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, Modal, SelectField, TextAreaField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { isRoleCode, ROLE_CODES, ROLE_LABELS, type RoleCode } from '../../shared/auth/roles';
import { RegistrationContext } from './RegistrationProvider';
import { REGISTRATION_STATUSES, STATUS_LABELS, type RegistrationPage, type RegistrationQuery, type RegistrationRequest } from './types';
import { queryFromParams, validateQuery } from './validation';
import styles from './registration.module.css';

const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
type Decision = { request: RegistrationRequest; kind: 'approve' | 'reject' };

export function RegistrationReviewPage() { return <RequireAuth><ReviewAccess /></RequireAuth>; }
function ReviewAccess() {
  const { user } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('CLUB_MANAGER')) return <main className="auth-problem"><ErrorState title="Access denied" description="Registration review is available to Club Managers only." /><ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Back to workspace</ButtonLink></main>;
  return <ReviewContent key={user.id} />;
}
function ReviewContent() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);
  const queryError = validateQuery(query);
  const [revision, setRevision] = useState(0);
  const change = (name: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); if (name !== 'page') next.set('page', '0'); setParams(next); };
  return <AppShell user={{ fullName: user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Administration' }, { label: 'Registration review' }]}>
    <div className={styles.stack}>
      <Link className={styles.back} to={ROUTES.dashboard}>← Back to workspace</Link>
      <PageHeader title="Registration review" description="Review access requests and assign exactly one role when approving." actions={<Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>Refresh requests</Button>} />
      <AlertBanner type="info" title="Club Manager approval is required">Applicants cannot choose roles. Approval creates an active account; rejection retains the request. Applicants are not sent an email or notification.</AlertBanner>
      <div className={styles.filters}>
        <SelectField label="Status" placeholder="All statuses" value={query.status ?? ''} options={REGISTRATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))} onChange={(event) => change('status', event.target.value)} />
        <SelectField label="Requests per page" value={String(query.size)} options={[...new Set([10, 20, 50, 100, ...(query.size >= 1 && query.size <= 100 ? [query.size] : [])])].map((value) => ({ value: String(value), label: String(value) }))} onChange={(event) => change('size', event.target.value)} />
        <Button variant="secondary" onClick={() => setParams({})}>Reset filters</Button>
      </div>
      {queryError ? <ErrorState title="Invalid registration filters" description={queryError} /> : <ReviewResults key={params.toString()} query={query} revision={revision} onRefresh={() => setRevision((value) => value + 1)} onPage={(value) => change('page', String(value))} />}
    </div>
  </AppShell>;
}

function ReviewResults({ query, revision, onRefresh, onPage }: { query: RegistrationQuery; revision: number; onRefresh: () => void; onPage: (value: number) => void }) {
  const service = useContext(RegistrationContext);
  const { handleApiError } = useAuth();
  const token = authSession.read()?.accessToken ?? '';
  const [result, setResult] = useState<{ source?: object; data?: RegistrationPage; error?: string; forbidden?: boolean }>({});
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState('');
  const source = useMemo(() => ({ service, query, token, revision }), [service, query, token, revision]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    service.list(source.query, { token: source.token, signal: controller.signal }).then((data) => { if (active) setResult({ source, data }); }).catch((cause: unknown) => {
      if (!active || handleApiError(cause)) return;
      setResult({ source, error: cause instanceof Error ? cause.message : 'Unable to load registration requests.', forbidden: cause instanceof ApiError && cause.status === 403 });
    });
    return () => { active = false; controller.abort(); };
  }, [source, service, handleApiError]);
  const current = result.source === source ? result : {};
  const data = current.data;
  const approved = useCallback((request: RegistrationRequest) => { setDecision(null); setNotice(`Request ${request.id} ${request.status === 'APPROVED' ? 'approved' : 'rejected'}.`); onRefresh(); }, [onRefresh]);
  return <>
    {notice && <AlertBanner type="success" title={notice} />}
    {!data ? current.error ? <ErrorState title={current.forbidden ? 'Access denied' : 'Registration requests unavailable'} description={current.error} onRetry={current.forbidden ? undefined : onRefresh} /> : <LoadingState label="Loading registration requests…" /> : <Card title="Access requests">
      <div className={styles.tableScroll}><DataTable<RegistrationRequest> caption="Registration requests" rows={data.items} rowKey={(row) => row.id} empty={<EmptyState title="No registration requests" description="No requests match this status and page." />} columns={[
        { key: 'applicant', header: 'Applicant', render: (row) => <div><strong>{row.fullName}</strong><span className={styles.secondary}>{row.email}</span></div> },
        { key: 'requested', header: 'Requested', render: (row) => <time dateTime={row.requestedAt} title={row.requestedAt}>{time(row.requestedAt)}</time> },
        { key: 'status', header: 'Status', render: (row) => STATUS_LABELS[row.status] },
        { key: 'decision', header: 'Decision', render: (row) => row.status === 'PENDING_APPROVAL' ? 'Awaiting review' : <div>{row.approvedRoleCode && <span>{ROLE_LABELS[row.approvedRoleCode]}</span>}{row.reviewedBy && <span className={styles.secondary}>By {row.reviewedBy.fullName}</span>}{row.reviewedAt && <time className={styles.secondary} dateTime={row.reviewedAt} title={row.reviewedAt}>{time(row.reviewedAt)}</time>}{row.decisionReason && <span className={styles.secondary}>{row.decisionReason}</span>}</div> },
        { key: 'actions', header: 'Actions', render: (row) => row.status === 'PENDING_APPROVAL' ? <div className={styles.actions}><Button size="sm" variant="secondary" aria-label={`Approve request ${row.id}`} onClick={() => setDecision({ request: row, kind: 'approve' })}>Approve</Button><Button size="sm" variant="tertiary" aria-label={`Reject request ${row.id}`} onClick={() => setDecision({ request: row, kind: 'reject' })}>Reject</Button></div> : 'Reviewed' },
      ]} /></div>
      <footer className={styles.pagination}>
        <span aria-live="polite">{data.items.length ? `Showing ${data.page * data.size + 1}–${data.page * data.size + data.items.length} of ${data.totalItems}` : `${data.totalItems} total requests`} · Page {data.page + 1} of {Math.max(1, data.totalPages)}</span>
        <div className={styles.actions}>{!data.items.length && data.page > 0 && <Button variant="secondary" onClick={() => onPage(0)}>First page</Button>}<Button variant="secondary" disabled={data.page === 0} onClick={() => onPage(data.page - 1)}>Previous</Button><Button variant="secondary" disabled={data.page + 1 >= data.totalPages} onClick={() => onPage(data.page + 1)}>Next</Button></div>
      </footer>
    </Card>}
    {decision && <DecisionDialog key={`${decision.request.id}:${decision.kind}`} decision={decision} onClose={() => setDecision(null)} onSuccess={approved} onRefresh={() => { setDecision(null); onRefresh(); }} />}
  </>;
}

function DecisionDialog({ decision, onClose, onSuccess, onRefresh }: { decision: Decision; onClose: () => void; onSuccess: (value: RegistrationRequest) => void; onRefresh: () => void }) {
  const service = useContext(RegistrationContext); const auth = useAuth();
  const [role, setRole] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false); const [pending, setPending] = useState(false); const busy = useRef(false); const formId = useId();
  const approving = decision.kind === 'approve';
  return <Modal open title={`${approving ? 'Approve' : 'Reject'} request ${decision.request.id}`} onClose={() => { if (!busy.current) onClose(); }} footer={<><Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" form={formId} disabled={pending || conflict}>{pending ? 'Saving decision…' : approving ? 'Confirm approval' : 'Confirm rejection'}</Button></>}>
    <form id={formId} className={styles.stack} noValidate aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault(); if (busy.current || conflict) return;
      setError('');
      if (approving && !isRoleCode(role)) { setError('Choose exactly one role before approving.'); return; }
      if (!approving && reason.length > 500) { setError('Reason must be 500 characters or fewer.'); return; }
      busy.current = true; setPending(true);
      try {
        const context = { token: authSession.read()?.accessToken ?? '' };
        const updated = approving ? await service.approve(decision.request.id, role as RoleCode, context) : await service.reject(decision.request.id, reason, context);
        onSuccess(updated);
      } catch (cause) {
        if (!auth.handleApiError(cause)) {
          const stale = cause instanceof ApiError && [404, 409].includes(cause.status); setConflict(stale);
          setError(stale ? 'This request could not be decided. Refresh the list before deciding again.' : cause instanceof Error ? cause.message : 'Unable to save the decision.');
        }
      } finally { busy.current = false; setPending(false); }
    }}>
      <KeyValue label="Applicant" value={decision.request.fullName} /><KeyValue label="Email" value={decision.request.email} />
      {approving ? <><SelectField label="Assigned role" placeholder="Choose one role" required value={role} disabled={pending} options={ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))} onChange={(event) => setRole(event.target.value)} /><p className={styles.note}>Approval creates an active account with this role. The applicant signs in with their original password.</p></> : <TextAreaField label="Rejection reason (optional)" maxLength={500} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} helperText="Visible only to Club Managers. The applicant is not notified." />}
      {error && <AlertBanner type="danger" title="Decision not saved">{error}{conflict && <Button variant="secondary" onClick={onRefresh}>Close and refresh</Button>}</AlertBanner>}
    </form>
  </Modal>;
}
