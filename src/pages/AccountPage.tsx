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
import { viLabel } from '../shared/viLabels';

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
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: user.roles[0] }} breadcrumb={[{ label: 'Tài khoản' }, { label: 'Tài khoản của tôi' }]}><div className={styles.stack}><h1>Tài khoản của tôi</h1>
    {resource.pending && <LoadingState label="Đang tải tài khoản…" />}{resource.error && <ErrorState title="Không tải được tài khoản" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <AccountForm key={`${resource.data.id}:${resource.data.fullName}`} profile={resource.data} />}
    <p><ButtonLink to={ROUTES.dashboard}>Quay lại không gian làm việc</ButtonLink></p>
    <Button disabled={busy} onClick={async () => { if (busy) return; setBusy(true); await logout(); navigate(ROUTES.login, { replace: true }); }}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</Button>
  </div></AppShell>;
}
function AccountForm({ profile }: { profile: UserDetail }) {
  const request = useFlowRequest();
  const [name, setName] = useState(profile.fullName), [savedName, setSavedName] = useState(profile.fullName);
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''); const inFlight = useRef(false);
  async function save(event: FormEvent, password: boolean) {
    event.preventDefault(); if (inFlight.current) return;
    if (password && (newPassword !== confirmPassword || !/\p{L}/u.test(newPassword) || !/\p{Nd}/u.test(newPassword) || new TextEncoder().encode(newPassword).length > 72)) { setError('Mật khẩu phải trùng khớp, có chữ cái và chữ số, tối đa 72 byte UTF-8.'); return; }
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (password) {
        await request<void>('/api/account/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Đã đổi mật khẩu.');
      } else {
        const updated = await request<UserDetail>('/api/account', { method: 'PUT', body: JSON.stringify({ fullName: name.trim() }) });
        // Restoring auth here would unmount the page and erase an unsaved password form.
        setName(updated.fullName); setSavedName(updated.fullName); setMessage('Đã lưu hồ sơ. Tải lại trang để cập nhật tên trên thanh tiêu đề.');
      }
    } catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <><UnsavedChangesGuard dirty={name !== savedName || !!currentPassword || !!newPassword || !!confirmPassword} />
    {error && <AlertBanner type="danger" title="Cập nhật tài khoản thất bại">{error}</AlertBanner>}{message && <AlertBanner type="success" title={message} />}
    <div className={styles.columns}><div className={styles.stack}>
      <Card title="Hồ sơ"><form onSubmit={(e) => { void save(e, false); }} className={styles.stack}>
        <div className={styles.filters}><TextField label="Họ và tên" required maxLength={150} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /><TextField label="Email" type="email" value={profile.email} readOnly helperText="Muốn đổi email cần liên hệ Club Manager." /></div>
        <Button type="submit" variant="secondary" disabled={busy || name === savedName}>Lưu hồ sơ</Button>
      </form></Card>
      <Card title="Đổi mật khẩu"><form onSubmit={(e) => { void save(e, true); }} className={styles.stack}>
        <TextField label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required value={currentPassword} disabled={busy} onChange={(e) => setCurrentPassword(e.target.value)} />
        <div className={styles.filters}><TextField label="Mật khẩu mới" type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={newPassword} disabled={busy} onChange={(e) => setNewPassword(e.target.value)} /><TextField label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" required value={confirmPassword} disabled={busy} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
        <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
        <p>Khôi phục mật khẩu chưa dùng được trên môi trường chính thức: cần có dịch vụ email được duyệt.</p>
      </form></Card>
    </div><Card title="Tài khoản & quyền truy cập"><KeyValue label="Mã người dùng" value={profile.userCode} /><KeyValue label="Vai trò" value={profile.roles.map((r) => ROLE_LABELS[r]).join(', ')} /><KeyValue label="Trạng thái tài khoản" value={viLabel(profile.accountStatus)} /><KeyValue label="Lần đăng nhập cuối" value={profile.lastLoginAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.lastLoginAt)) : 'Chưa bao giờ'} /><p>Vai trò và quyền hạn của bạn do Club Manager quản lý.</p></Card></div>
  </>;
}
