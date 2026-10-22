import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, LoadingState, RadioGroup, SelectField, StatusBadge, TextField, UnsavedChangesGuard } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../../shared/auth/roles';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { accountApi, type UserDetail, type UserInput } from './accountApi';
import styles from './Administration.module.css';
import { CORE_ROLE_MATRIX } from './approvedRoleMatrix';

const roleOptions = ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }));
const time = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
export function UserListPage() {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(0);
  const load = useMemo(() => (signal: AbortSignal) => api.list(new URLSearchParams({ q, ...(role ? { role } : {}), ...(status ? { status } : {}), page: String(page), size: '20' }), signal), [api, q, role, status, page]);
  const resource = useResource(load);
  return <FlowShell title="Staff & Users" section="Administration" role="CLUB_MANAGER" description="One account per person. Accounts are deactivated, never deleted." actions={<div className={styles.actions}><ButtonLink variant="secondary" to="/admin/roles">Roles & Permissions</ButtonLink><ButtonLink to="/admin/users/new">Create User</ButtonLink></div>}>
    <div className={styles.stack}><div className={styles.filters}>
      <TextField label="Search name, email or ID" type="search" maxLength={100} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <SelectField label="Role" value={role} options={[{ value: '', label: 'All roles' }, ...roleOptions]} onChange={(e) => { setRole(e.target.value); setPage(0); }} />
      <SelectField label="Status" value={status} options={[{ value: '', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} onChange={(e) => { setStatus(e.target.value); setPage(0); }} />
    </div>
    {resource.pending && <LoadingState label="Loading accounts…" />}{resource.error && <ErrorState title="Accounts unavailable" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <><Card><div className={styles.scroll}><DataTable rows={resource.data.items} rowKey={(u) => u.id} caption="Staff and users" empty={<EmptyState title="No matching accounts" />} columns={[
      { key: 'name', header: 'Name', render: (u) => u.fullName }, { key: 'code', header: 'User ID', render: (u) => u.userCode },
      { key: 'email', header: 'Email', render: (u) => u.email }, { key: 'role', header: 'Role', render: (u) => u.roles.map((r) => ROLE_LABELS[r]).join(', ') },
      { key: 'status', header: 'Status', render: (u) => <StatusBadge family="account" status={u.accountStatus} /> },
      { key: 'login', header: 'Last login', render: (u) => time(u.lastLoginAt) }, { key: 'edit', header: 'Action', render: (u) => <ButtonLink size="sm" variant="secondary" to={`/admin/users/${u.id}/edit`} aria-label={`Edit ${u.fullName}`}>Edit</ButtonLink> },
    ]} /></div></Card><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>{resource.data.totalItems} accounts · page {page + 1}</span><Button variant="secondary" disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></>}
    </div></FlowShell>;
}
export function UserEditorPage() {
  const { id } = useParams();
  if (id !== undefined && (!Number.isSafeInteger(Number(id)) || Number(id) < 1)) return <FlowShell title="User unavailable" section="Administration" role="CLUB_MANAGER"><ErrorState title="Invalid user ID" /></FlowShell>;
  return <UserEditorLoader key={id ?? 'new'} id={id === undefined ? undefined : idOf(id)} />;
}
function UserEditorLoader({ id }: { id?: number }) {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const load = useMemo(() => (signal: AbortSignal) => id === undefined ? Promise.resolve(null) : api.detail(id, signal), [id, api]);
  const resource = useResource(load);
  return <FlowShell title={id ? 'Edit User' : 'Create User'} section="Administration" role="CLUB_MANAGER" description="Exactly one role; permissions are enforced by the Backend.">
    {resource.pending && <LoadingState label="Loading user…" />}{resource.error && <ErrorState title="User unavailable" description={resource.error} onRetry={resource.reload} />}
    {!resource.pending && !resource.error && <UserEditor key={id ?? 'new'} initial={resource.data ?? null} />}
  </FlowShell>;
}
function UserEditor({ initial }: { initial: UserDetail | null }) {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]), { user } = useAuth(), navigate = useNavigate();
  const [name, setName] = useState(initial?.fullName ?? ''), [email, setEmail] = useState(initial?.email ?? ''), [role, setRole] = useState<RoleCode>(initial?.roles[0] ?? 'GROOM');
  const [current, setCurrent] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(''); const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (saved) void navigate('/admin/users'); }, [saved, navigate]);
  const dirty = name !== (initial?.fullName ?? '') || email !== (initial?.email ?? '') || role !== (initial?.roles[0] ?? 'GROOM');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
    const input: UserInput = { fullName: name.trim(), email: email.trim(), roleCode: role, experienceYears: initial?.experienceYears ?? null, experienceLevel: initial?.experienceLevel ?? null,
      skillIds: role === initial?.roles[0] ? initial.skills.map((s) => s.id) : [] };
    try { if (initial) await api.update(initial.id, input); else await api.create(input); setSaved(true); }
    catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  async function changeStatus() {
    if (!current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { setCurrent(await api.status(current.id, current.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')); }
    catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <><UnsavedChangesGuard dirty={!saved && (dirty || busy)} /><form onSubmit={(e) => { void submit(e); }} className={styles.stack}>
    <div className={styles.columns}><div className={styles.stack}><Card title="Profile"><div className={styles.filters}>
      <TextField label="Full name" required maxLength={150} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /><TextField label="Email" type="email" required maxLength={254} value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
    </div><p className={styles.muted}>{initial ? `User ID ${initial.userCode} cannot be changed.` : 'User ID is assigned automatically. Initial status is ACTIVE under the approved API contract.'}</p></Card>
    <Card title="Role"><RadioGroup label="Application role" required value={role} disabled={busy} options={roleOptions} onChange={(value) => setRole(value as RoleCode)} helperText="Changing a role changes access; historical records are retained. There are no custom roles." /></Card>
    {current && <Card title="Account status"><StatusBadge family="account" status={current.accountStatus} /><p>Inactive accounts cannot sign in. Their records are kept.</p><Button type="button" className={styles.statusAction} variant={current.accountStatus === 'ACTIVE' ? 'danger' : 'secondary'} disabled={busy || current.id === user?.id} onClick={() => { void changeStatus(); }}>{current.accountStatus === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}</Button></Card>}
    </div><Card title="What this role can access"><p>{ROLE_LABELS[role]}</p><p>Permissions are fixed by the approved role and Backend row scope.</p><ButtonLink variant="secondary" to="/admin/roles">View Roles & Permissions</ButtonLink><p>Horse Owners see only their linked horses. Managers do not assign passwords.</p></Card></div>
    {error && <AlertBanner type="danger" title="User was not saved">{error}</AlertBanner>}
    <div className={styles.actions}>{busy ? <Button type="button" variant="secondary" disabled>Cancel</Button> : <ButtonLink variant="secondary" to="/admin/users">Cancel</ButtonLink>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save Changes' : 'Create User'}</Button></div>
  </form></>;
}
export function RolesPage() {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const load = useMemo(() => (signal: AbortSignal) => api.roles(signal), [api]), resource = useResource(load);
  return <FlowShell title="Roles & Permissions" section="Administration" role="CLUB_MANAGER" description="Read-only role catalogue. Permissions cannot be edited per user." actions={<ButtonLink variant="secondary" to="/admin/users">View users</ButtonLink>}>
    {resource.pending && <LoadingState label="Loading roles…" />}{resource.error && <ErrorState title="Roles unavailable" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <div className={styles.stack}>
      <AlertBanner type="info" title="Read-only approved permission reference">V view · C create · E edit · D deactivate/soft delete · X execute. Assignment and ownership scopes remain enforced by the Backend. Deferred modules are omitted.</AlertBanner>
      <Card><div className={styles.scroll}><DataTable rows={[...CORE_ROLE_MATRIX]} rowKey={(r) => r.id} caption="Approved core feature permission matrix from Figma 290:3537" columns={[
        { key: 'feature', header: 'Feature', render: (r) => `${r.feature} · ${r.id}` },
        ...ROLE_CODES.map((r, index) => ({ key: r, header: ROLE_LABELS[r], render: (row: (typeof CORE_ROLE_MATRIX)[number]) => row.access[index] })),
      ]} /></div></Card>
      <Card title="Current Backend role catalogue"><DataTable rows={resource.data} rowKey={(r) => r.roleCode} caption="Backend roles and row scopes" columns={[{ key: 'role', header: 'Role', render: (r) => r.displayName }, { key: 'scope', header: 'Scope', render: (r) => r.scoping }]} /></Card>
    </div>}
  </FlowShell>;
}
