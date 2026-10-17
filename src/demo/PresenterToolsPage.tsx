import { useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card } from '../design-system';
import { authSession } from '../shared/auth/authSession';
import { resetSamples } from '../shared/data/sampleStore';
import './demo.css';

/**
 * DEVELOPMENT HARNESS ONLY — /presenter-tools. Not linked from any navigation, registered only in harness/presentation
 * dev modes and absent from production builds. Prepares a presentation: restores the starting sample scenario and
 * signs out the local simulated session. Accounts are documented outside the UI (PRESENTATION-GUIDE).
 */
export function PresenterToolsPage() {
  const [done, setDone] = useState(false);
  const reset = () => {
    resetSamples();
    authSession.clear();
    setDone(true);
  };
  return (
    <main className="ui-demo-page" style={{ margin: '48px auto', padding: '0 24px' }}>
      <h1 className="text-h1">Presenter tools</h1>
      <p className="ui-demo-page__note">Local development only. This page is not part of the product navigation and is not included in production builds.</p>
      <Card title="Prepare a presentation">
        <p className="text-body">Restores the starting illustrative data in this browser and signs out the current local session. No server or database is touched.</p>
        <Button onClick={reset}>Reset illustrative data and sign out</Button>
        {done && <AlertBanner type="success" title="Ready">The starting scenario is restored. <Link to="/login">Open the sign-in page</Link>.</AlertBanner>}
      </Card>
    </main>
  );
}
