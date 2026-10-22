import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, ButtonLink, Icon, TextField } from '../../design-system';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import authStyles from '../../pages/LoginPage.module.css';
import styles from './registration.module.css';
import { passwordAllowed } from './validation';

const NEUTRAL = 'If an account exists for this email, a reset link has been sent.';
const busyMessage = (cause: unknown, fallback: string) => cause instanceof ApiError && cause.status === 429 ? 'Too many requests. Please try again later.' : fallback;

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
        <Link className={styles.back} to={ROUTES.login}>← Back to sign in</Link>
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
    if (!/^[^\s@]+@[^\s@]+$/u.test(value) || value.length > 254) { setFieldError('Enter a valid email, up to 254 characters.'); document.getElementById(id)?.focus(); return; }
    busy.current = true; setPending(true); setFieldError(''); setError('');
    try { await requestApi('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: value }) }); setEmail(''); setDone(true); }
    catch (cause) { setError(busyMessage(cause, 'Your request could not be sent. Try again.')); }
    finally { busy.current = false; setPending(false); }
  }
  return <AuthCard title="Reset password" intro="Enter the email of your account. Newly created staff accounts use this to set their first password.">
    {done ? <div className={styles.stack}><AlertBanner type="success" title="Request received">{NEUTRAL}</AlertBanner>
      <p className={styles.note}>The link expires after 30 minutes and works once. No email service is connected yet: in development the link is written to the server's development outbox.</p>
      <ButtonLink variant="primary" to={ROUTES.login}>Return to sign in</ButtonLink></div> : <>
      {error && <AlertBanner type="danger" title="Request not sent">{error}</AlertBanner>}
      <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
        <TextField id={id} label="Email" type="email" autoComplete="email" maxLength={254} required disabled={pending} value={email} error={fieldError} onChange={(event) => setEmail(event.target.value)} className={authStyles.loginField} />
        <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>
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
    if (!passwordAllowed(values.newPassword)) issues.newPassword = 'Use 8–64 characters with a letter and a digit, at most 72 UTF-8 bytes.';
    if (!values.confirmPassword || values.confirmPassword !== values.newPassword) issues.confirmPassword = 'Passwords must match.';
    setErrors(issues); setError('');
    if (Object.keys(issues).length) { document.getElementById(`${prefix}-${Object.keys(issues)[0]}`)?.focus(); return; }
    busy.current = true; setPending(true);
    try { await requestApi<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, ...values }) }); setValues({ newPassword: '', confirmPassword: '' }); setDone(true); }
    catch (cause) { setError(busyMessage(cause, 'This reset link is invalid, already used or expired. Request a new link.')); }
    finally { busy.current = false; setPending(false); }
  }
  const field = (key: 'newPassword' | 'confirmPassword', label: string) => <TextField id={`${prefix}-${key}`} label={label} type={visible ? 'text' : 'password'} autoComplete="new-password" required disabled={pending} value={values[key]} error={errors[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={authStyles.loginField} />;
  return <AuthCard title="Set a new password" intro="Choose a new password for your account. Your role and account status do not change.">
    {done ? <div className={styles.stack}><AlertBanner type="success" title="Password updated">Sign in with your new password.</AlertBanner><ButtonLink variant="primary" to={ROUTES.login}>Return to sign in</ButtonLink></div>
      : !token ? <div className={styles.stack}><AlertBanner type="danger" title="Reset link missing">Open the full link from your reset message, or request a new one.</AlertBanner><ButtonLink variant="primary" to={ROUTES.forgotPassword}>Request a new link</ButtonLink></div> : <>
        {error && <AlertBanner type="danger" title="Password not updated">{error} <Link to={ROUTES.forgotPassword}>Request a new link</Link></AlertBanner>}
        <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
          {field('newPassword', 'New password')}
          {field('confirmPassword', 'Confirm new password')}
          <p className={styles.note}>Password: 8–64 characters, including a letter and a digit, at most 72 UTF-8 bytes.</p>
          <Button variant="tertiary" disabled={pending} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? 'Hide passwords' : 'Show passwords'}</Button>
          <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Set new password'}</Button>
        </form>
      </>}
  </AuthCard>;
}
