// Browser verification only. Every fixture below is intercepted HTTP/STOMP test data, never application runtime data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FE_SMOKE_URL || 'http://127.0.0.1:5178';
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function fixture(file) {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('require', 'exports', out)((id) => fixture(path.resolve(path.dirname(file), `${id}.ts`)), exports); return exports;
}
const { fixtureResponse, headTrainer } = fixture(path.join(root, 'src/features/program-creation/__tests__/httpFixtures.ts'));
const horse = { id: 7, horseCode: 'RD-015', name: 'Test Horse', breed: 'Thoroughbred', lifecycle: 'DRAFT', trainingAvailability: 'AVAILABLE', currentBoxCode: 'B-07' };
const program = { id: 10, horse: { ...horse, lifecycle: 'ACTIVE' }, name: 'Test Program', status: 'ACTIVE', phases: [{ id: 31, phaseOrder: 1, name: 'Foundation', objective: 'Balance', startDate: '2026-11-01', endDate: '2026-11-30' }] };
const session = { id: 42, sessionCode: 'SES-0042', horse, programId: 10, horseProgramPhaseId: 31, phaseName: 'Foundation', scheduledStart: '2026-11-05T06:00:00Z', status: 'SCHEDULED', workRider: { id: 5, fullName: 'Test Rider' }, blocked: false, blockedReasons: [], trainingAvailability: 'AVAILABLE', exercises: [{ id: 8, exerciseDefinitionId: 8, exerciseOrder: 1, exerciseName: 'Walk', durationMin: 20, intensity: 'LOW' }] };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let role = 'VETERINARIAN', baselinePosts = 0, sessionPosts = 0;
    const pageErrors = []; page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'fixture-main-flows-jwt', expiresAt: Date.now() + 3600000 }));
      class TestSocket {
        readyState = 1;
        constructor() { queueMicrotask(() => this.onopen?.()); }
        send(frame) {
          if (frame.startsWith('CONNECT')) queueMicrotask(() => this.onmessage?.({ data: 'CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0' }));
          if (frame.startsWith('SUBSCRIBE') && frame.includes('id:metrics')) queueMicrotask(() => this.onmessage?.({ data: `MESSAGE\nsubscription:metrics\n\n${JSON.stringify({ sessionId: 42, recordedAt: '2026-11-05T06:10:00Z', heartRate: 152, speedKmh: 36, distanceM: 1450, source: 'SIMULATOR', simulated: true, realtimeState: 'NORMAL' })}\0` }));
        }
        close() { this.readyState = 3; this.onclose?.(); }
      }
      window.WebSocket = TestSocket;
    });
    await page.route('http://localhost:8080/api/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let data;
      if (p === '/api/auth/me') data = { ...headTrainer, roles: [role] };
      else if (p === '/api/horses/7') data = horse;
      else if (p.endsWith('/activation-status')) data = { checklist: [{ id: 'IDENTITY', label: 'Profile created (DRAFT)', state: 'SATISFIED', requirement: 'MANDATORY' }] };
      else if (p.endsWith('/baseline-examinations')) { baselinePosts++; data = { id: 91, horseId: 7, weightKg: 512, healthStatus: 'FIT', recordedAt: '2026-10-19T06:00:00Z' }; }
      else if (p.endsWith('/medical-thresholds')) data = [{ metricType: 'HEART_RATE', thresholdValue: 180, scope: 'GLOBAL' }];
      else if (p.endsWith('/training-availability')) data = { horseId: 7, availability: 'LIMITED', reason: 'Walk only', exerciseRules: [{ ruleType: 'ALLOWED', exerciseTypeNote: 'Walk' }] };
      else if (p === '/api/medical/restrictions') data = { items: [], totalPages: 0 };
      else if (p === '/api/horses' && role !== 'HEAD_TRAINER') data = { items: [horse], totalPages: 1, totalItems: 1 };
      else if (p === '/api/training-programs' && req.method() === 'GET') data = { items: [program], totalItems: 1, totalPages: 1 };
      else if (p === '/api/training-programs/10') data = program;
      else if (p === '/api/exercises') data = [{ id: 8, name: 'Walk' }];
      else if (p.endsWith('/suitability-check')) data = { trainingAvailability: 'AVAILABLE', sessionBlocked: false, sessionIssues: [], exercises: [] };
      else if (p.endsWith('/work-rider-recommendations')) data = { candidates: [{ user: session.workRider, label: 'SUITABLE', warnings: [], reasons: ['Available for the selected time'], skills: [], hardBlock: null }] };
      else if (p === '/api/training-sessions' && req.method() === 'POST') { sessionPosts++; data = session; }
      else if (p === '/api/training-sessions') data = [];
      else if (p === '/api/training-sessions/42') data = session;
      else if (p === '/api/training-sessions/42/result') data = { session, actual: { sampleCount: 0 }, samples: [], alerts: [] };
      else {
        const res = fixtureResponse(url, { method: req.method(), body: req.postData() }, { ...headTrainer, roles: [role] });
        return route.fulfill({ status: res.status, contentType: 'application/json', headers, body: await res.text() });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ success: true, data }) });
    });
    const output = path.join(root, 'docs/evidence/hoang-main-flows'); fs.mkdirSync(output, { recursive: true });
    const shot = (file) => page.screenshot({ path: path.join(output, file), fullPage: true });
    await page.goto(`${base}/horses/7/baseline`); await page.getByRole('heading', { name: 'Initial Health Baseline · Test Horse' }).waitFor();
    await shot('015-baseline.png'); await page.getByLabel('Weight (kg)', { exact: false }).fill('512'); await page.getByLabel('Current condition', { exact: false }).fill('Normal gait'); await page.getByRole('radio', { name: 'FIT', exact: true }).check(); await page.getByRole('button', { name: 'Save Baseline' }).click(); await page.getByText('Baseline saved', { exact: true }).waitFor();
    role = 'TRAINER'; await page.goto(`${base}/dashboard`); await page.getByRole('heading', { name: 'Trainer Dashboard' }).waitFor(); await shot('025-dashboard.png');
    await page.getByRole('link', { name: '+ New Training Session' }).click();
    await page.getByLabel('Program', { exact: true }).selectOption('10'); await page.getByLabel('Phase', { exact: true }).selectOption('31'); await page.getByLabel('Date', { exact: false }).fill('2026-11-05'); await page.getByLabel('Start time', { exact: false }).fill('06:00'); await page.getByLabel('Expected duration', { exact: false }).fill('60'); await shot('025-create-step1.png');
    await page.getByRole('button', { name: 'Next: Exercises' }).click(); await page.getByLabel('Add exercise').selectOption('8'); await shot('025-create-step2.png'); await page.getByRole('button', { name: 'Next: Work Rider' }).click(); await page.getByRole('button', { name: 'Select Rider' }).click(); await shot('025-create-step3.png'); await page.getByRole('button', { name: 'Next: Review' }).click(); await page.getByRole('button', { name: 'Save & Notify' }).click(); await page.getByRole('heading', { name: 'Training Session · Foundation' }).waitFor(); await shot('025-session-detail.png');
    await page.goto(`${base}/medical/restrictions?horseId=7`); await page.getByText('Walk only', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Save Training Availability' }).count(), 0); await shot('020-read-only.png');
    await page.goto(`${base}/training/monitoring?sessionId=42`); await page.getByText('SIMULATED DEMO DATA', { exact: true }).waitFor(); await page.getByText('152 bpm', { exact: true }).waitFor(); await shot('031-monitoring-simulated-test.png');
    role = 'HEAD_TRAINER'; await page.goto(`${base}/training/programs/new`); await page.getByRole('radio', { name: 'Select Thunder Bolt', exact: true }).check(); await shot('022-horse-selected.png');
    role = 'GROOM'; await page.goto(`${base}/horses/7/baseline`); await page.getByText('Your account does not have permission to access this page.', { exact: true }).waitFor();
    assert.equal(baselinePosts, 1); assert.equal(sessionPosts, 1); assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ result: 'PASS', evidence: 'Test HTTP/STOMP fixtures, not live BE', baselinePosts, sessionPosts, pageErrors, screenshots: fs.readdirSync(output) }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
