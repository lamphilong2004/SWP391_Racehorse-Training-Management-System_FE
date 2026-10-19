import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LiveMonitoringPage } from './LiveMonitoringPage';

const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { fullName: 'Test Trainer', roles: ['TRAINER'] } }) }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => mock.request }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mock.request.mockReset(); });
it('renders no telemetry, classification or simulated badge when no server samples exist', async () => {
  const session = { id: 42, horse: { id: 7, name: 'Test Horse', horseCode: 'H-007' }, sessionCode: 'SES-42', phaseName: 'Foundation', status: 'SCHEDULED', trainingAvailability: 'AVAILABLE', exercises: [] };
  mock.request.mockImplementation(async (path: string) => path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [] } : path.endsWith('/medical-thresholds') ? [] : session);
  render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Test Horse · H-007' });
  expect(screen.getByText('No telemetry received.')).toBeInTheDocument(); expect(screen.getByText('No heart-rate samples')).toBeInTheDocument();
  expect(screen.queryByText('SIMULATED DEMO DATA')).not.toBeInTheDocument(); expect(screen.queryByText('NORMAL · server classification')).not.toBeInTheDocument();
  expect(screen.getAllByText('Not measured')).toHaveLength(4);
});
it('shows the API failure without fabricating a session or metric', async () => {
  mock.request.mockRejectedValue(new Error('Session API unavailable'));
  render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>);
  expect(await screen.findByText('Session API unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Connected', { exact: true })).not.toBeInTheDocument(); expect(screen.getAllByText('Not measured')).toHaveLength(4);
});
