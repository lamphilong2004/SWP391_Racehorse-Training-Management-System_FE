import { useContext, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, AlertBanner, Button, Icon, TextField } from '../../design-system';
import { ApiError } from '../../shared/auth/authApi';
import authStyles from '../../pages/LoginPage.module.css';
import styles from './registration.module.css';
import { RegistrationContext } from './RegistrationProvider';
import { NEUTRAL_CONFIRMATION, type RegisterRequest } from './types';
import { validateRegistration } from './validation';

const empty: RegisterRequest = { fullName: '', email: '', password: '', confirmPassword: '' };
export function RegisterPage() {
  const service = useContext(RegistrationContext);
  const [values, setValues] = useState<RegisterRequest>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterRequest, string>>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const busy = useRef(false);
  const prefix = useId();
  const clear = () => { setValues(empty); setVisible(false); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const issues = validateRegistration(values); setErrors(issues); setError('');
    if (Object.keys(issues).length) { document.getElementById(`${prefix}-${Object.keys(issues)[0]}`)?.focus(); return; }
    busy.current = true; setPending(true);
    try { await service.register(values); clear(); setDone(true); }
    catch (cause) {
      // Never display account-existence signals or echo arbitrary password-related server details.
      setError(cause instanceof ApiError && cause.status === 429 ? 'Quá nhiều yêu cầu. Hãy thử lại sau.' : 'Chưa xác nhận được yêu cầu. Hãy kiểm tra thông tin và thử lại.');
    } finally { busy.current = false; setPending(false); }
  }
  const field = (key: keyof RegisterRequest, label: string, type = 'text', autoComplete?: string, maxLength?: number) => <TextField id={`${prefix}-${key}`} label={label} type={type} autoComplete={autoComplete} maxLength={maxLength} required disabled={pending} value={values[key]} error={errors[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={authStyles.loginField} />;
  return <main className={`${authStyles.page} ${styles.registerPage}`}>
    <section className={authStyles.photoPanel} aria-label="Racehorse Ops">
      <img className={authStyles.photo} src="/assets/login-horse.jpeg" alt="" />
      <div className={authStyles.photoFade} />
      <div className={authStyles.logo}><span className={authStyles.logoMark}><Icon name="horseshoe" size={18} /></span><span>Racehorse Ops</span></div>
      <div className={authStyles.tagline}><h2 className="text-landing-display-m">Chính xác trong <em>từng sải bước.</em></h2><p className="text-body-l">Huấn luyện, sức khỏe và chăm sóc hằng ngày — một hệ thống cho cả trại ngựa.</p></div>
    </section>
    <section className={`${authStyles.formPanel} ${styles.registerPanel}`} aria-labelledby="register-title">
      <div className={styles.registerContent}>
        <Link className={styles.back} to={ROUTES.login} onClick={clear}>← Quay lại đăng nhập</Link>
        <header className={authStyles.heading}><h1 id="register-title" className="text-landing-display-m">Yêu cầu cấp quyền truy cập</h1><p className="text-body-l">Gửi thông tin để Club Manager xem xét. Club Manager sẽ cấp vai trò cho bạn.</p></header>
        {done ? <div className={styles.stack}><AlertBanner type="success" title="Đã nhận yêu cầu">{NEUTRAL_CONFIRMATION}</AlertBanner><p>Bạn có thể đăng nhập bằng mật khẩu của mình sau khi yêu cầu được duyệt. Hệ thống không gửi email hay thông báo cho bạn.</p><ButtonLink variant="primary" to={ROUTES.login}>Quay lại đăng nhập</ButtonLink></div> : <>
          {error && <AlertBanner type="danger" title="Chưa xác nhận được yêu cầu">{error}</AlertBanner>}
          <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
            {field('fullName', 'Họ và tên', 'text', 'name', 150)}
            {field('email', 'Email', 'email', 'email', 254)}
            {field('password', 'Mật khẩu', visible ? 'text' : 'password', 'new-password')}
            {field('confirmPassword', 'Nhập lại mật khẩu', visible ? 'text' : 'password', 'new-password')}
            <p className={styles.note}>Mật khẩu: 8–64 ký tự, có chữ cái và chữ số, tối đa 72 byte UTF-8, khác với email của bạn.</p>
            <Button variant="tertiary" disabled={pending} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</Button>
            <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Đang gửi…' : 'Gửi yêu cầu truy cập'}</Button>
          </form>
          <p className={styles.note}>Gửi yêu cầu không tạo tài khoản và không đăng nhập cho bạn.</p>
        </>}
      </div>
    </section>
  </main>;
}
