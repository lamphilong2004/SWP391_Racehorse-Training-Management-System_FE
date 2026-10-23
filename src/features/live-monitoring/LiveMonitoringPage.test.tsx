import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LiveMonitoringPage } from './LiveMonitoringPage';

const mock = vi.hoisted(() => ({ request: vi.fn(), connect: vi.fn(), roles: ['TRAINER'] }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { fullName: 'Test User', roles: mock.roles } }) }));
vi.mock('./sessionStream', () => ({ connectSessionStream: mock.connect }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => mock.request }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mock.request.mockReset(); mock.connect.mockReset().mockReturnValue(() => {}); mock.roles = ['TRAINER']; });
it('renders no telemetry, classification or simulated badge when no server samples exist', async () => {
  const session = { id: 42, horse: { id: 7, name: 'Test Horse', horseCode: 'H-007' }, sessionCode: 'SES-42', phaseName: 'Foundation', status: 'SCHEDULED', trainingAvailability: 'AVAILABLE', exercises: [] };
  mock.request.mockImplementation(async (path: string) => path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [] } : path.endsWith('/medical-thresholds') ? [] : session);
  render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Test Horse · H-007' });
  expect(screen.getByText('Chưa nhận được dữ liệu đo.')).toBeInTheDocument(); expect(screen.getByText('Chưa có số đo nhịp tim')).toBeInTheDocument();
  expect(screen.queryByText('DỮ LIỆU MÔ PHỎNG')).not.toBeInTheDocument(); expect(screen.queryByText('NORMAL · phân loại từ máy chủ')).not.toBeInTheDocument();
  expect(screen.getAllByText('Chưa đo')).toHaveLength(4);
});
it('shows the API failure without fabricating a session or metric', async () => {
  mock.request.mockRejectedValue(new Error('Session API unavailable'));
  render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>);
  expect(await screen.findByText('Session API unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Đã kết nối', { exact: true })).not.toBeInTheDocument(); expect(screen.getAllByText('Chưa đo')).toHaveLength(4);
});

function recordedSession(status = 'PAUSED', blocked = false) {
  const session = { id: 42, horse: { id: 7, name: 'Test Horse', horseCode: 'H-007' }, sessionCode: 'SES-42', phaseName: 'Base', status, trainingAvailability: blocked ? 'LOCKED' : 'AVAILABLE', blocked, exercises: [] };
  mock.request.mockImplementation(async (path: string) => path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [] } : path.endsWith('/medical-thresholds') ? [] : session);
  return session;
}
function mount() { render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>); }
it('resumes a PAUSED session with the approved bodyless POST and reloads server state', async () => {
  const session = recordedSession(); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục buổi tập' }));
  await waitFor(() => expect(mock.request).toHaveBeenCalledWith('/api/training-sessions/42/resume', { method: 'POST' }));
  // A successful transport without an updated REST status does not invent IN_PROGRESS.
  await screen.findByRole('button', { name: 'Tiếp tục buổi tập' });
  expect(session.status).toBe('PAUSED');
  expect(screen.getByRole('button', { name: 'Tạm dừng buổi tập' })).toBeDisabled();
});
it('keeps Resume disabled for LOCKED horses and absent for a read-only Head Trainer', async () => {
  recordedSession('PAUSED', true); const view = render(<MemoryRouter initialEntries={['/training/monitoring?sessionId=42']}><LiveMonitoringPage /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Tiếp tục buổi tập' })).toBeDisabled();
  view.unmount(); mock.roles = ['HEAD_TRAINER']; recordedSession(); mount();
  await screen.findByRole('heading', { name: 'Test Horse · H-007' });
  expect(screen.queryByRole('button', { name: 'Tiếp tục buổi tập' })).not.toBeInTheDocument();
  expect(mock.request.mock.calls.some(([path, init]) => path.endsWith('/resume') && init?.method === 'POST')).toBe(false);
});
it('shows simulated alert events even when no metric sample has arrived', async () => {
  sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'test-jwt', expiresAt: Date.now() + 60000 }));
  recordedSession('IN_PROGRESS'); mount();
  await waitFor(() => expect(mock.connect).toHaveBeenCalledTimes(1));
  act(() => mock.connect.mock.calls[0][0].onEvent({ topic: 'alerts', data: { sessionId: 42, type: 'WARNING', simulated: true } }));
  expect(await screen.findByText('DỮ LIỆU MÔ PHỎNG')).toBeInTheDocument();
  expect(screen.getByText('Cảnh báo · phân loại từ máy chủ')).toBeInTheDocument();
  expect(screen.getAllByText('Chưa đo')).toHaveLength(4);
});

const critical = { id: 77, sessionId: 42, metric: 'HEART_RATE', metricValue: 186, thresholdApplied: 180, severity: 'CRITICAL', raisedAt: '2026-10-20T06:00:00Z', acknowledgedAt: null };
it.each(['HEAD_TRAINER', 'CLUB_MANAGER'])('shows existing critical Alert Detail read-only for %s', async (role) => {
  mock.roles = [role]; const session = recordedSession();
  mock.request.mockImplementation(async (path: string) => path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [critical] } : path.endsWith('/medical-thresholds') ? [] : session);
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Xem cảnh báo 77' }));
  const dialog = await screen.findByRole('dialog', { name: 'Chi tiết cảnh báo' });
  expect(within(dialog).getByText('Nghiêm trọng', { exact: true })).toBeInTheDocument();
  expect(within(dialog).getByText('186 bpm')).toBeInTheDocument(); expect(within(dialog).getByText('180 bpm')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận cảnh báo' })).not.toBeInTheDocument();
  expect(mock.request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});
it.each(['TRAINER', 'VETERINARIAN'])('allows %s to acknowledge from detail using only the approved payload', async (role) => {
  mock.roles = [role]; const session = recordedSession(); let acknowledged = false;
  mock.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') { acknowledged = true; return { ...critical, acknowledgedAt: '2026-10-20T06:01:00Z' }; }
    return path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [{ ...critical, acknowledgedAt: acknowledged ? '2026-10-20T06:01:00Z' : null }] } : path.endsWith('/medical-thresholds') ? [] : session;
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Xem cảnh báo 77' }));
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Chi tiết cảnh báo' })).getByRole('button', { name: 'Xác nhận cảnh báo' }));
  await waitFor(() => expect(mock.request).toHaveBeenCalledWith('/api/monitoring-alerts/77/acknowledge', { method: 'POST', body: '{"action":"ACKNOWLEDGE"}' }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' })).toBeInTheDocument());
  expect(within(screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' })).queryByRole('button', { name: 'Xác nhận cảnh báo' })).not.toBeInTheDocument();
});
it('preserves warning severity and unavailable fields without permitting critical-alert acknowledgement', async () => {
  sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'test-jwt', expiresAt: Date.now() + 60000 }));
  recordedSession(); mount(); await waitFor(() => expect(mock.connect).toHaveBeenCalledTimes(1));
  act(() => mock.connect.mock.calls[0][0].onEvent({ topic: 'alerts', data: { sessionId: 42, type: 'WARNING', severity: 'WARNING', metric: 'HEART_RATE', metricValue: 170, simulated: true } }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết cảnh báo' }));
  const dialog = await screen.findByRole('dialog', { name: 'Chi tiết cảnh báo' });
  expect(within(dialog).getByText('Cảnh báo', { exact: true })).toBeInTheDocument();
  expect(within(dialog).getByText('170 bpm')).toBeInTheDocument(); expect(within(dialog).getByText('Chưa đo')).toBeInTheDocument();
  expect(within(dialog).getByText('DỮ LIỆU MÔ PHỎNG')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận cảnh báo' })).not.toBeInTheDocument();
});
it('merges sparse STOMP acknowledgement/escalation into the open detail instead of losing existing fields', async () => {
  sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'test-jwt', expiresAt: Date.now() + 60000 }));
  const session = recordedSession();
  mock.request.mockImplementation(async (path: string) => path.endsWith('/result') ? { session, actual: {}, samples: [], alerts: [critical] } : path.endsWith('/medical-thresholds') ? [] : session);
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Xem cảnh báo 77' })); await waitFor(() => expect(mock.connect).toHaveBeenCalledTimes(1));
  act(() => mock.connect.mock.calls[0][0].onEvent({ topic: 'alerts', data: { sessionId: 42, alertId: 77, type: 'CRITICAL_ACKNOWLEDGED', severity: 'CRITICAL', acknowledgedAt: '2026-10-20T06:01:00Z', acknowledgedBy: { id: 9, fullName: 'Server Vet' }, actionTaken: 'ACKNOWLEDGE' } }));
  const dialog = screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' });
  expect(await within(dialog).findByText('Server Vet')).toBeInTheDocument(); expect(within(dialog).getByText('186 bpm')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xác nhận cảnh báo' })).not.toBeInTheDocument();
  act(() => mock.connect.mock.calls[0][0].onEvent({ topic: 'alerts', data: { sessionId: 42, alertId: 77, type: 'CRITICAL_ESCALATED', escalatedToVetAt: '2026-10-20T06:02:00Z' } }));
  expect(within(dialog).getByText('Server Vet')).toBeInTheDocument();
});
