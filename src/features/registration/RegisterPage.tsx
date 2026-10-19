import { useContext, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, Icon, TextField } from '../../design-system';
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
      setError(cause instanceof ApiError && cause.status === 429 ? 'Too many requests. Please try again later.' : 'Your request could not be confirmed. Check your details and try again.');
    } finally { busy.current = false; setPending(false); }
  }
  const field = (key: keyof RegisterRequest, label: string, type = 'text', autoComplete?: string, maxLength?: number) => <TextField id={`${prefix}-${key}`} label={label} type={type} autoComplete={autoComplete} maxLength={maxLength} required disabled={pending} value={values[key]} error={errors[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={authStyles.loginField} />;
  return <main className={`${authStyles.page} ${styles.registerPage}`}>
    <section className={authStyles.photoPanel} aria-label="Racehorse Ops">
      <img className={authStyles.photo} src="/assets/login-horse.jpeg" alt="" />
      <div className={authStyles.photoFade} />
      <div className={authStyles.logo}><span className={authStyles.logoMark}><Icon name="horseshoe" size={18} /></span><span>Racehorse Ops</span></div>
      <div className={authStyles.tagline}><h2 className="text-landing-display-m">Precision in <em>every stride.</em></h2><p className="text-body-l">Training, health and daily care — one system for the whole stable.</p></div>
    </section>
    <section className={`${authStyles.formPanel} ${styles.registerPanel}`} aria-labelledby="register-title">
      <div className={styles.registerContent}>
        <Link className={styles.back} to={ROUTES.login} onClick={clear}>← Back to sign in</Link>
        <header className={authStyles.heading}><h1 id="register-title" className="text-landing-display-m">Request access</h1><p className="text-body-l">Submit your details for Club Manager review. Your Club Manager assigns your role.</p></header>
        {done ? <div className={styles.stack}><AlertBanner type="success" title="Request received">{NEUTRAL_CONFIRMATION}</AlertBanner><p>You can sign in with your password after your request is approved. No email or notification is sent to you.</p><Link to={ROUTES.login}>Return to sign in</Link></div> : <>
          {error && <AlertBanner type="danger" title="Request not confirmed">{error}</AlertBanner>}
          <form className={styles.stack} onSubmit={submit} noValidate aria-busy={pending}>
            {field('fullName', 'Full name', 'text', 'name', 150)}
            {field('email', 'Email', 'email', 'email', 254)}
            {field('password', 'Password', visible ? 'text' : 'password', 'new-password')}
            {field('confirmPassword', 'Confirm password', visible ? 'text' : 'password', 'new-password')}
            <p className={styles.note}>Password: 8–64 characters, including a letter and a digit, at most 72 UTF-8 bytes. Use a password different from your email.</p>
            <Button variant="tertiary" disabled={pending} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? 'Hide passwords' : 'Show passwords'}</Button>
            <Button className={authStyles.submitButton} size="lg" type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit access request'}</Button>
          </form>
          <p className={styles.note}>Submitting a request does not create an account or sign you in.</p>
        </>}
      </div>
    </section>
  </main>;
}
