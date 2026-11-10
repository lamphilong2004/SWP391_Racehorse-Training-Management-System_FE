import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../shared/auth/authApi';
import { SessionDetailPage } from './SessionDetailPage';
import type { TrainingSession } from './sessionApi';

const { request, actor } = vi.hoisted(() => ({
  request: vi.fn(),
  actor: { user: { id: 5, fullName: 'Trainer', roles: ['TRAINER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) },
}));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => actor }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => request }));

const missing: TrainingSession = {
  id: 6, sessionCode: 'TS-6', horse: { id: 9, name: 'Blue Harbor', horseCode: 'VB' },
  programId: 2, horseProgramPhaseId: 2, phaseName: 'Familiarisation', status: 'SCHEDULED',
  scheduledStart: '2026-01-03T03:00:00Z', workRider: { id: 7, fullName: 'Rider' },
  trainer: { id: 5, fullName: 'Trainer' }, groom: null, preSessionCheck: null,
  trainingAvailability: 'AVAILABLE', blocked: true, blockedReasons: ['PRE_CHECK_MISSING'], exercises: [],
};

function mount() {
  const router = createMemoryRouter([{ path: '/training/session/:id', element: <SessionDetailPage /> }], { initialEntries: ['/training/session/6'] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  actor.user.roles = ['TRAINER'];
  request.mockReset().mockImplementation((path: string) => Promise.resolve(path.endsWith('/groom-candidates') ? [] : missing));
});

it('explains the missing assignment and exact-session check without clearing the server block', async () => {
  mount();
  expect(await screen.findByText(/Groom chưa lưu kiểm tra trước buổi tập cho đúng buổi này\./)).toBeInTheDocument();
  expect(screen.getByText('Trainer cần lưu phân công Groom cho buổi này trước khi Groom có thể kiểm tra.')).toBeInTheDocument();
  expect(screen.getByText(/Kết quả của buổi khác không thay thế được/)).toBeInTheDocument();
  expect(screen.getByText('Chưa có kết quả được lưu cho buổi này')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phân công & thông báo Groom' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Xem kết quả & điều kiện đánh giá' })).toHaveAttribute('href', '/training/sessions/6/evaluation');
  expect(screen.queryByRole('button', { name: 'Lưu đánh giá' })).not.toBeInTheDocument();
  expect(screen.queryByText('PRE_CHECK_MISSING')).not.toBeInTheDocument();
});

it('reloads the same session from the API after Groom saves, without issuing a mutation', async () => {
  mount();
  await screen.findByText('Chưa có kết quả được lưu cho buổi này');
  request.mockImplementation((path: string) => Promise.resolve(path.endsWith('/groom-candidates') ? [] : {
    ...missing, groom: { id: 2, fullName: 'Groom' }, preSessionCheck: { overallResult: 'ALL_NORMAL' }, blocked: false, blockedReasons: [],
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('Tất cả bình thường');
  expect(screen.queryByText('Chưa có kết quả được lưu cho buổi này')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  await waitFor(() => expect(request.mock.calls.filter(([path]) => path === '/api/training-sessions/6')).toHaveLength(2));
  expect(request.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('keeps a reload failure visible and offers no start or assignment control to Head Trainer', async () => {
  actor.user.roles = ['HEAD_TRAINER'];
  mount();
  await screen.findByText('Chưa có kết quả được lưu cho buổi này');
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  request.mockRejectedValue(new Error('Connection unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('Connection unavailable');
  expect(screen.queryByText('Tất cả bình thường')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bắt đầu buổi tập' })).not.toBeInTheDocument();
});

it('guides a completed session to results and evaluation without offering assignment or start', async () => {
  request.mockResolvedValue({ ...missing, status: 'COMPLETED', blocked: false, blockedReasons: [] });
  mount();
  expect(await screen.findByText('1. Xem kết quả đã ghi và so sánh kế hoạch với thực tế.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở đánh giá của Trainer' })).toHaveAttribute('href', '/training/sessions/6/evaluation');
  expect(screen.queryByText('1. Trainer phân công Groom cho đúng mã buổi tập.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bắt đầu buổi tập' })).not.toBeInTheDocument();
});

it.each(['IN_PROGRESS', 'PAUSED'] as const)('lets a Trainer open Report Incident for %s sessions', async (status) => {
  request.mockResolvedValue({ ...missing, status, blocked: false, blockedReasons: [] });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  expect(screen.getByRole('form', { name: 'Báo cáo sự cố' })).toBeInTheDocument();
  expect(screen.getByLabelText('Mô tả sự cố')).toBeInTheDocument();
  expect(screen.getByLabelText('Loại sự cố')).toBeInTheDocument();
  expect(screen.getByLabelText('Mức độ nghiêm trọng')).toBeInTheDocument();
});

it('does not expose Report Incident to a role the endpoint does not permit', async () => {
  actor.user.roles = ['HEAD_TRAINER'];
  request.mockResolvedValue({ ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] });
  mount();
  await screen.findByRole('button', { name: 'Tải lại buổi tập' });
  expect(screen.queryByRole('button', { name: 'Báo cáo sự cố' })).not.toBeInTheDocument();
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});

it('posts the incident contract, displays response identifiers and updates the session to INTERRUPTED', async () => {
  let session: TrainingSession = { ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] };
  const result = { incidentId: 67, incidentCode: 'INC-0067', sessionStatus: 'INTERRUPTED' as const };
  request.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/api/training-sessions/6/report-issue' && init?.method === 'POST') {
      session = { ...session, status: 'INTERRUPTED', interruptionReason: 'Ngựa có dấu hiệu khập khiễng' };
      return Promise.resolve(result);
    }
    return Promise.resolve(path.endsWith('/groom-candidates') ? [] : session);
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Ngựa có dấu hiệu khập khiễng' } });
  fireEvent.change(screen.getByLabelText('Loại sự cố'), { target: { value: 'LAMENESS' } });
  fireEvent.change(screen.getByLabelText('Mức độ nghiêm trọng'), { target: { value: 'MEDIUM' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo sự cố' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/training-sessions/6/report-issue', {
    method: 'POST',
    body: JSON.stringify({ description: 'Ngựa có dấu hiệu khập khiễng', incidentType: 'LAMENESS', observedSeverity: 'MEDIUM' }),
  }));
  expect(await screen.findByText(/INC-0067/)).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector('[data-status="INTERRUPTED"]')).toBeInTheDocument());
  expect(request.mock.calls.filter(([path]) => path === '/api/training-sessions/6')).toHaveLength(2);
  expect(document.querySelector('[data-status="INTERRUPTED"]')).toBeInTheDocument();
  expect(screen.getByText('Thông tin gián đoạn')).toBeInTheDocument();
  expect(screen.getAllByText('Ngựa có dấu hiệu khập khiễng').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Báo cáo sự cố' })).not.toBeInTheDocument();
});

it('validates incident fields and surfaces API errors without sending invalid payloads', async () => {
  request.mockResolvedValue({ ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Mô tả hợp lệ' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Báo cáo sự cố' }));
  expect(await screen.findByText('Chọn loại sự cố và mức độ nghiêm trọng.')).toBeInTheDocument();
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

  request.mockImplementation((path: string, init?: RequestInit) => {
    if (path.endsWith('/report-issue') && init?.method === 'POST') return Promise.reject(new Error('Incident API unavailable'));
    return Promise.resolve(path.endsWith('/groom-candidates') ? [] : { ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] });
  });
  fireEvent.change(screen.getByLabelText('Loại sự cố'), { target: { value: 'LAMENESS' } });
  fireEvent.change(screen.getByLabelText('Mức độ nghiêm trọng'), { target: { value: 'MEDIUM' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo sự cố' }));
  expect(await screen.findByText('Incident API unavailable')).toBeInTheDocument();
});

it.each([
  { status: 403, code: 'FORBIDDEN' as const, message: 'Session access denied.' },
  { status: 404, code: 'NOT_FOUND' as const, message: 'Session not found.' },
])('keeps the successful incident receipt but hides session details when refresh returns $status', async ({ status, code, message }) => {
  let reads = 0;
  request.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/api/training-sessions/6' && !init?.method) {
      reads += 1;
      return reads === 1
        ? Promise.resolve({ ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] })
        : Promise.reject(new ApiError(status, code, message));
    }
    if (path === '/api/training-sessions/6/report-issue') {
      return Promise.resolve({ incidentId: 68, incidentCode: 'INC-0068', sessionStatus: 'INTERRUPTED' });
    }
    return Promise.resolve(path.endsWith('/groom-candidates') ? [] : missing);
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Sự cố cần báo cáo' } });
  fireEvent.change(screen.getByLabelText('Loại sự cố'), { target: { value: 'LAMENESS' } });
  fireEvent.change(screen.getByLabelText('Mức độ nghiêm trọng'), { target: { value: 'MEDIUM' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo sự cố' }));

  expect(await screen.findByText(/INC-0068/)).toBeInTheDocument();
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.queryByText(/Blue Harbor · VB/)).not.toBeInTheDocument();
  expect(screen.queryByText('Thông tin gián đoạn')).not.toBeInTheDocument();
  expect(document.querySelector('[data-status="INTERRUPTED"]')).not.toBeInTheDocument();
});

it('resets the incident draft when navigation switches to a different session', async () => {
  const otherSession: TrainingSession = {
    ...missing, id: 7, sessionCode: 'TS-7', horse: { id: 10, name: 'New Horse', horseCode: 'NH' },
    status: 'IN_PROGRESS', blocked: false, blockedReasons: [],
  };
  request.mockImplementation((path: string) => Promise.resolve(path === '/api/training-sessions/7' ? otherSession : path.endsWith('/groom-candidates') ? [] : { ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] }));
  const router = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Observation from session 6' } });

  await act(async () => { await router.navigate('/training/session/7'); });
  expect((await screen.findAllByText(/New Horse · NH/)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Báo cáo sự cố' }));
  expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('');
  expect(screen.getByLabelText('Loại sự cố')).toHaveValue('');
  expect(screen.getByLabelText('Mức độ nghiêm trọng')).toHaveValue('');
});

it('ignores a late report response after navigation and keeps the new session draft open', async () => {
  const otherSession: TrainingSession = {
    ...missing, id: 7, sessionCode: 'TS-7', horse: { id: 10, name: 'New Horse', horseCode: 'NH' },
    status: 'IN_PROGRESS', blocked: false, blockedReasons: [],
  };
  let resolvePost!: (result: { incidentId: number; incidentCode: string; sessionStatus: 'INTERRUPTED' }) => void;
  const pendingPost = new Promise<{ incidentId: number; incidentCode: string; sessionStatus: 'INTERRUPTED' }>((resolve) => { resolvePost = resolve; });
  request.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/api/training-sessions/6/report-issue' && init?.method === 'POST') return pendingPost;
    return Promise.resolve(path === '/api/training-sessions/7' ? otherSession : path.endsWith('/groom-candidates') ? [] : { ...missing, status: 'IN_PROGRESS', blocked: false, blockedReasons: [] });
  });
  const router = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Observation from session 6' } });
  fireEvent.change(screen.getByLabelText('Loại sự cố'), { target: { value: 'LAMENESS' } });
  fireEvent.change(screen.getByLabelText('Mức độ nghiêm trọng'), { target: { value: 'MEDIUM' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo sự cố' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/training-sessions/6/report-issue', expect.any(Object)));

  await act(async () => { await router.navigate('/training/session/7'); });
  expect((await screen.findAllByText(/New Horse · NH/)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Mô tả sự cố'), { target: { value: 'Observation from session 7' } });
  await act(async () => {
    resolvePost({ incidentId: 69, incidentCode: 'INC-0069', sessionStatus: 'INTERRUPTED' });
    await pendingPost;
  });

  expect(screen.getByRole('form', { name: 'Báo cáo sự cố' })).toBeInTheDocument();
  expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('Observation from session 7');
  expect(screen.queryByText(/INC-0069/)).not.toBeInTheDocument();
  expect(request.mock.calls.some(([path]) => path === '/api/training-sessions/7/report-issue')).toBe(false);
});
