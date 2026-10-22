import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner } from '../design-system/components/AlertBanner/AlertBanner';
import { Button } from '../design-system/components/Button/Button';
import { Checkbox } from '../design-system/components/Checkbox/Checkbox';
import { Icon } from '../design-system/icons/Icon';
import { TextField } from '../design-system/components/TextField/TextField';
import { ApiError } from '../shared/auth/authApi';
import { useAuth } from '../shared/auth/AuthProvider';
import styles from './LoginPage.module.css';

interface LoginLocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setEmailError(undefined);
    setPasswordError(undefined);
    try {
      await auth.login(email, password, remember);
      const from = (location.state as LoginLocationState | null)?.from?.pathname;
      navigate(from?.startsWith('/') ? from : '/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        for (const detail of error.details) {
          if (detail.field === 'email') setEmailError(detail.message);
          if (detail.field === 'password') setPasswordError(detail.message);
        }
        setFormError(error.message);
      } else {
        setFormError('Could not sign in. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page} data-ui-v3>
      <section className={styles.photoPanel} aria-label="Racehorse Ops">
        <img className={styles.photo} src="/assets/login-horse.jpeg" alt="" />
        <div className={styles.photoFade} />
        <div className={styles.logo}>
          <span className={styles.logoMark}>
            <Icon name="horseshoe" size={18} />
          </span>
          <span>Racehorse Ops</span>
        </div>
        <div className={styles.tagline}>
          <h2 className="text-landing-display-m">
            Precision in <em>every stride.</em>
          </h2>
          <p className="text-body-l">Training, health and daily care — one system for the whole stable.</p>
        </div>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-title">
        <a className={styles.backLink} href="/" aria-label="Back to overview">
          ←&nbsp; Back to overview
        </a>
        <div className={styles.formContent}>
          <header className={styles.heading}>
            <h1 id="login-title" className="text-landing-display-m">Sign in to Racehorse Ops</h1>
            <p className="text-body-l">Use the account issued by your Club Manager.</p>
          </header>

          {auth.message && <AlertBanner type="info" title={auth.message} />}
          {formError && <AlertBanner type="danger" title="Sign-in failed">{formError}</AlertBanner>}

          <form className={styles.form} onSubmit={submit}>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              error={emailError}
              className={styles.loginField}
            />
            <div className={styles.passwordField}>
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={64}
                required
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                error={passwordError}
                className={styles.loginField}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <Icon name="eye" size={20} />
              </button>
            </div>
            <div className={styles.formOptions}>
              <Checkbox label="Remember me" checked={remember} onChange={(event) => setRemember(event.currentTarget.checked)} />
              <button type="button" className={styles.forgotLink} onClick={() => setFormError('Password reset is not available in this login flow yet. Contact your Club Manager.')}>Forgot password?</button>
            </div>
            <Button type="submit" size="lg" disabled={submitting} className={styles.submitButton}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className={styles.noSignup}>
            <Icon name="lock" size={18} className={styles.lockIcon} />
            <p>No public sign-up. Accounts and roles are created by your Club Manager.</p>
          </div>
        </div>

        <div className={styles.footer}>
          <p>© 2026 Racehorse Ops · Web application</p>
        </div>
      </section>
    </main>
  );
}
