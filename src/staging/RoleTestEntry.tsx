import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card } from '../design-system';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import styles from './staging.module.css';

/** Protected Preview only: choose one of the seven roles to inspect the official UI. No accounts, passwords or data. */
export function RoleTestEntry() {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function enter(role: RoleCode) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await auth.login(role, '', false);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
    } catch { setMessage('Không mở được không gian làm việc. Hãy thử lại.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.entry}>
    <Card>
      <p className="text-caption">Racehorse Ops · MÔI TRƯỜNG THỬ ĐƯỢC BẢO VỆ</p>
      <h1 className="text-h1">Đăng nhập thử theo vai trò</h1>
      <AlertBanner type="warning" title="Chỉ xem giao diện — không truy cập máy chủ">Vai trò thử không phải tài khoản thật. Màn hình cần máy chủ sẽ báo lỗi, và không có dữ liệu nào được tạo, sửa hay lưu. Không nhập dữ liệu cá nhân hay dữ liệu thật.</AlertBanner>
      <p className="text-body">Chọn vai trò để xem không gian làm việc. Dùng Menu tài khoản → Đăng xuất để chọn vai trò khác.</p>
      {message && <AlertBanner type="danger" title={message} />}
      <div className={styles.roles} role="group" aria-label="Vai trò thử">{ROLE_CODES.map((role) => <Button key={role} variant="secondary" size="lg" disabled={busy} onClick={() => void enter(role)}>{ROLE_LABELS[role]}</Button>)}</div>
    </Card>
  </main>;
}
