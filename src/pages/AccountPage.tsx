import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { AlertBanner, ButtonLink, Button, Card, ErrorState, KeyValue, LoadingState, TextField, UnsavedChangesGuard } from '../design-system';
import { AppShell } from '../layout/AppShell';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROUTES } from '../app/routePaths';
import { ROLE_LABELS } from '../shared/auth/roles';
import { errorMessage, useFlowRequest } from '../features/main-flows/api';
import { useResource } from '../features/main-flows/useResource';
import type { UserDetail } from '../features/administration/accountApi';
import styles from '../features/administration/Administration.module.css';

/** Shared account entry from every feature header; identity always comes from canonical backend auth. */
export function AccountPage() {
  const { user } = useAuth();
  return user ? <AccountContent key={user.id} /> : null;
}
function AccountContent() {
  const request = useFlowRequest();
  const load = useMemo(() => (signal: AbortSignal) => request<UserDetail>('/api/account', { signal }), [request]);
  const resource = useResource(load);
  const { user, logout } = useAuth(), navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: user.roles[0] }} breadcrumb={[{ label: 'Account' }, { label: 'My Account' }]}><div className={styles.stack}><h1>My Account</h1>
    {resource.pending && <LoadingState label="Loading account…" />}{resource.error && <ErrorState title="Account unavailable" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <AccountForm key={`${resource.data.id}:${resource.data.fullName}`} profile={resource.data} />}
    <p><ButtonLink to={ROUTES.dashboard}>Back to workspace</ButtonLink></p>
    <Button disabled={busy} onClick={async () => { if (busy) return; setBusy(true); await logout(); navigate(ROUTES.login, { replace: true }); }}>{busy ? 'Signing out…' : 'Sign out'}</Button>
  </div></AppShell>;
}
function AccountForm({ profile }: { profile: UserDetail }) {
  const request = useFlowRequest();
  const [name, setName] = useState(profile.fullName), [savedName, setSavedName] = useState(profile.fullName);
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''); const inFlight = useRef(false);
  async function save(event: FormEvent, password: boolean) {
    event.preventDefault(); if (inFlight.current) return;
    if (password && (newPassword !== confirmPassword || !/\p{L}/u.test(newPassword) || !/\p{Nd}/u.test(newPassword) || new TextEncoder().encode(newPassword).length > 72)) { setError('Passwords must match, contain a letter and a digit, and use at most 72 UTF-8 bytes.'); return; }
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (password) {
        await request<void>('/api/account/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password changed by the server.');
      } else {
        const updated = await request<UserDetail>('/api/account', { method: 'PUT', body: JSON.stringify({ fullName: name.trim() }) });
        // Restoring auth here would unmount the page and erase an unsaved password form.
        setName(updated.fullName); setSavedName(updated.fullName); setMessage('Profile saved by the server. Refresh to update the header name.');
      }
    } catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <><UnsavedChangesGuard dirty={name !== savedName || !!currentPassword || !!newPassword || !!confirmPassword} />
    {error && <AlertBanner type="danger" title="Account update failed">{error}</AlertBanner>}{message && <AlertBanner type="success" title={message} />}
    <div className={styles.columns}><div className={styles.stack}>
      <Card title="Profile"><form onSubmit={(e) => { void save(e, false); }} className={styles.stack}>
        <div className={styles.filters}><TextField label="Full name" required maxLength={150} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /><TextField label="Email" type="email" value={profile.email} readOnly helperText="Email changes require the Club Manager." /></div>
        <Button type="submit" variant="secondary" disabled={busy || name === savedName}>Save profile</Button>
      </form></Card>
      <Card title="Change password"><form onSubmit={(e) => { void save(e, true); }} className={styles.stack}>
        <TextField label="Current password" type="password" autoComplete="current-password" required value={currentPassword} disabled={busy} onChange={(e) => setCurrentPassword(e.target.value)} />
        <div className={styles.filters}><TextField label="New password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={newPassword} disabled={busy} onChange={(e) => setNewPassword(e.target.value)} /><TextField label="Confirm new password" type="password" autoComplete="new-password" required value={confirmPassword} disabled={busy} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button>
        <p>Password recovery is not enabled for production: an approved email provider is still required.</p>
      </form></Card>
    </div><Card title="Account & access"><KeyValue label="User ID" value={profile.userCode} /><KeyValue label="Role" value={profile.roles.map((r) => ROLE_LABELS[r]).join(', ')} /><KeyValue label="Account status" value={profile.accountStatus} /><KeyValue label="Last login" value={profile.lastLoginAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.lastLoginAt)) : 'Never'} /><p>Your role and permissions are managed by the Club Manager.</p></Card></div>
  </>;
}
