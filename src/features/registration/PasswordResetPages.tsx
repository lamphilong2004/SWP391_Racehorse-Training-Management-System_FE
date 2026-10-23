import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, ButtonLink, Icon, TextField } from '../../design-system';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import authStyles from '../../pages/LoginPage.module.css';
import styles from './registration.module.css';
import { passwordAllowed } from './validation';

const NEUTRAL = 'Nếu email này có tài khoản, liên kết đặt lại mật khẩu đã được gửi.';
const busyMessage = (cause: unknown, fallback: string) => cause instanceof ApiError && cause.status === 429 ? 'Quá nhiều yêu cầu. Hãy thử lại sau.' : fallback;

/** DEC-008 R9: same public layout as Request access; responses never reveal whether an account exists. */
function AuthCard({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <main className={`${authStyles.page} ${styles.registerPage}`}>
    <section className={authStyles.photoPanel} aria-label="Racehorse Ops">
      <img className={authStyles.photo} src="/assets/login-horse.jpeg" alt="" />
      <div className={authStyles.photoFade} />
      <div className={authStyles.logo}><span className={authStyles.logoMark}><Icon name="horseshoe" size={18} /></span><span>Racehorse Ops</span></div>
    </section>
    <section className={`${authStyles.formPanel} ${styles.registerPanel}`} aria-labelledby="password-reset-title">
      <div className={styles.registerContent}>
        <Link className={styles.back} to={ROUTES.login}>← Quay lại đăng nhập</Link>
        <header className={authStyles.heading}><h1 id="password-reset-title" className="text-landing-display-m">{title}</h1><p className="text-body-l">{intro}</p></header>
        {children}
      </div>
    </section>
  </main>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''), [fieldError, setFieldError] = useState(''), [error, setError] = useState('');
  const [pending, setPending] = useState(false), [done, setDone] = useState(false);
  const busy = useRef(false), id = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+$/u.test(value) || value.length > 254) { setFieldError('Nhập email hợp lệ, tối đa 254 ký tự.'); document.getElementById(id)?.focus(); return; }
    busy.current = true; setPending(true); setFieldError(''); setError('');
    try { await requestApi('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: value }) }); setEmail(''); setDone(true); }
    catch (cause) { setError(busyMessage(cause, 'Không gửi được yêu cầu. Hãy thử lại.')); }
    finally { busy.current = false; setPending(false); }
  }
  return <AuthCard title="Đặt lại mật khẩu" intro="Nhập email tài khoản của bạn. Tài khoản nhân sự mới tạo dùng chức năng này để đặt mật khẩu lần đầu.">
    {done ? <div className={styles.stack}><AlertBanner type="success" title="Đã nhận yêu cầu">{NEUTRAL}</AlertBanner>
      <p className={styles.note}>Liên kết hết hạn sau 30 phút và chỉ dùng được một lần. Hệ thống chưa kết nối dịch vụ email: trong môi trường phát triển, liên kết được ghi vào hộp thư thử nghiệm của máy chủ.</p>
      <ButtonLink variant="primary" to={ROUTES.login}>Quay lại đăng nhập</ButtonLink></div> : <>
      {error && <AlertBanner type="danger" title="Chưa gửi được yêu cầu">{error}</AlertBanner>}
      <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
        <TextField id={id} label="Email" type="email" autoComplete="email" maxLength={254} required disabled={pending} value={email} error={fieldError} onChange={(event) => setEmail(event.target.value)} className={authStyles.loginField} />
        <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}</Button>
      </form>
    </>}
  </AuthCard>;
}

export function ResetPasswordPage() {
  const [params, setParams] = useSearchParams();
  // Keep the single-use token in memory only and drop it from the address bar and history.
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => { if (params.has('token')) setParams({}, { replace: true }); }, [params, setParams]);
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<'newPassword' | 'confirmPassword', string>>>({});
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [done, setDone] = useState(false), [visible, setVisible] = useState(false);
  const busy = useRef(false), prefix = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const issues: typeof errors = {};
    if (!passwordAllowed(values.newPassword)) issues.newPassword = 'Dùng 8–64 ký tự, có chữ cái và chữ số, tối đa 72 byte UTF-8.';
    if (!values.confirmPassword || values.confirmPassword !== values.newPassword) issues.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    setErrors(issues); setError('');
    if (Object.keys(issues).length) { document.getElementById(`${prefix}-${Object.keys(issues)[0]}`)?.focus(); return; }
    busy.current = true; setPending(true);
    try { await requestApi<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, ...values }) }); setValues({ newPassword: '', confirmPassword: '' }); setDone(true); }
    catch (cause) { setError(busyMessage(cause, 'Liên kết đặt lại không hợp lệ, đã dùng hoặc đã hết hạn. Hãy yêu cầu liên kết mới.')); }
    finally { busy.current = false; setPending(false); }
  }
  const field = (key: 'newPassword' | 'confirmPassword', label: string) => <TextField id={`${prefix}-${key}`} label={label} type={visible ? 'text' : 'password'} autoComplete="new-password" required disabled={pending} value={values[key]} error={errors[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={authStyles.loginField} />;
  return <AuthCard title="Đặt mật khẩu mới" intro="Chọn mật khẩu mới cho tài khoản. Vai trò và trạng thái tài khoản không thay đổi.">
    {done ? <div className={styles.stack}><AlertBanner type="success" title="Đã cập nhật mật khẩu">Hãy đăng nhập bằng mật khẩu mới.</AlertBanner><ButtonLink variant="primary" to={ROUTES.login}>Quay lại đăng nhập</ButtonLink></div>
      : !token ? <div className={styles.stack}><AlertBanner type="danger" title="Thiếu liên kết đặt lại">Mở đầy đủ liên kết trong thư đặt lại, hoặc yêu cầu liên kết mới.</AlertBanner><ButtonLink variant="primary" to={ROUTES.forgotPassword}>Yêu cầu liên kết mới</ButtonLink></div> : <>
        {error && <AlertBanner type="danger" title="Chưa cập nhật được mật khẩu">{error} <Link to={ROUTES.forgotPassword}>Yêu cầu liên kết mới</Link></AlertBanner>}
        <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
          {field('newPassword', 'Mật khẩu mới')}
          {field('confirmPassword', 'Nhập lại mật khẩu mới')}
          <p className={styles.note}>Mật khẩu: 8–64 ký tự, có chữ cái và chữ số, tối đa 72 byte UTF-8.</p>
          <Button variant="tertiary" disabled={pending} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</Button>
          <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Đặt mật khẩu mới'}</Button>
        </form>
      </>}
  </AuthCard>;
}
