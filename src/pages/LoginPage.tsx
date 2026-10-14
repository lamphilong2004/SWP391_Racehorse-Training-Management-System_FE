import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card, TextField } from '../design-system';
import { Icon } from '../design-system/icons/Icon';
import { ROUTES } from '../app/routePaths';
import { errorMessage } from '../shared/api/http';
import { useAuth } from '../shared/auth/authState';
import styles from './LoginPage.module.css';

/** DEMO INTEGRATION: minimal sign-in (CORE-008 owns the final Login screen). POST /api/auth/login (CORE-007). */
export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to={ROUTES.dashboard} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== ROUTES.login ? from : ROUTES.dashboard, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <Icon name="horseshoe" size={28} />
          <span>Racehorse Ops</span>
        </div>
        <Card title="Sign in">
          <form className={styles.form} onSubmit={submit} noValidate>
            {error && <AlertBanner type="danger" title="Sign-in failed">{error}</AlertBanner>}
            <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className={styles.note}>Accounts are created by the Club Manager. Your role decides your workspace.</p>
      </div>
    </main>
  );
}
