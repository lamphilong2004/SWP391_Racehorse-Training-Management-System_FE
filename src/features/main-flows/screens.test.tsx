import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BaselinePage } from '../baseline/BaselinePage';
import { CreateSessionPage } from '../trainer-session/CreateSessionPage';
import { RestrictionsPage } from '../restrictions/RestrictionsPage';
import { SessionDetailPage } from '../trainer-session/SessionDetailPage';

const state = vi.hoisted(() => ({ request: vi.fn(), user: { id: 2, fullName: 'Test Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('./api', async (original) => ({ ...await original<typeof import('./api')>(), useFlowRequest: () => state.request }));
const horse = { id: 7, horseCode: 'RD-015', name: 'Test Horse', lifecycle: 'DRAFT', trainingAvailability: 'AVAILABLE', breed: 'Thoroughbred' };
beforeEach(() => { state.request.mockReset(); state.user.roles = ['VETERINARIAN']; });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

it('reads completed Groom checks from the approved nested preSessionCheck response', async () => {
  state.user.roles = ['TRAINER'];
  state.request.mockResolvedValue({ id: 42, sessionCode: 'SES-42', horse, status: 'SCHEDULED', scheduledStart: '2026-11-05T06:00:00Z', phaseName: 'Base', trainingAvailability: 'AVAILABLE', blocked: false, blockedReasons: [], exercises: [], preSessionCheck: { overallResult: 'ALL_NORMAL' } });
  render(<MemoryRouter initialEntries={['/training/session/42']}><Routes><Route path="/training/session/:id" element={<SessionDetailPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Tất cả bình thường')).toBeInTheDocument();
  expect(screen.queryByText('Đang chờ', { exact: true })).not.toBeInTheDocument();
});

it('keeps a failed baseline draft for retry and confirms only a real save response', async () => {
  let fail = true;
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/activation-status')) return { checklist: [] };
    if (init?.method === 'POST') { if (fail) throw new Error('Baseline endpoint unavailable'); return { id: 9, horseId: 7, weightKg: 512, healthStatus: 'FIT', recordedAt: '2026-10-19T06:00:00Z' }; }
    return horse;
  });
  render(<MemoryRouter initialEntries={['/horses/7/baseline']}><Routes><Route path="/horses/:id/baseline" element={<BaselinePage />} /></Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Khám sức khỏe ban đầu · Test Horse' });
  change('Cân nặng (kg)', '512'); change('Thể trạng hiện tại', 'Normal gait'); fireEvent.click(screen.getByRole('radio', { name: 'Khỏe' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả khám' }));
  expect(await screen.findByText('Baseline endpoint unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('Cân nặng (kg)', { exact: false })).toHaveValue(512);
  expect(screen.queryByText('Đã lưu kết quả khám ban đầu')).not.toBeInTheDocument();
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả khám' }));
  expect(await screen.findByText('Đã lưu kết quả khám ban đầu')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu kết quả khám' })).toBeDisabled();
});
it('schedules one session through all four steps using the approved draft/recommendation/create operations', async () => {
  state.user.roles = ['TRAINER']; let posts = 0;
  const program = { id: 10, horse, name: 'Test program', status: 'ACTIVE', phases: [{ id: 31, name: 'Foundation', startDate: '2026-11-01', endDate: '2026-11-30' }] };
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith('/api/training-programs?')) return { items: [program] };
    if (path === '/api/training-programs/10') return program;
    if (path.endsWith('/training-availability')) return { availability: 'AVAILABLE' };
    if (path === '/api/exercises') return [{ id: 8, name: 'Walk' }];
    if (path.endsWith('/suitability-check')) return { trainingAvailability: 'AVAILABLE', sessionBlocked: false, exercises: [], sessionIssues: [] };
    if (path.endsWith('/work-rider-recommendations')) return { candidates: [{ user: { id: 5, fullName: 'Test Rider' }, label: 'SUITABLE', warnings: [], reasons: [], skills: [], hardBlock: null }] };
    if (path === '/api/training-sessions' && init?.method === 'POST') { posts++; return { id: 42 }; }
    throw new Error(`Unexpected test request: ${path}`);
  });
  render(<MemoryRouter initialEntries={['/training/schedule/session/new']}><Routes><Route path="/training/schedule/session/new" element={<CreateSessionPage />} /><Route path="/training/session/:id" element={<h1>Saved session detail</h1>} /></Routes></MemoryRouter>);
  await screen.findByRole('option', { name: 'Test Horse · Test program' }); change('Chương trình', '10');
  await screen.findByRole('option', { name: 'Foundation' }); change('Giai đoạn', '31'); change('Ngày', '2026-11-05'); change('Giờ bắt đầu', '06:00'); change('Thời lượng dự kiến', '60');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp: Bài tập' }));
  await screen.findByRole('option', { name: 'Walk' }); change('Thêm bài tập', '8');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp: Work Rider' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn Test Rider' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp: Xem lại' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu & thông báo' }));
  expect(await screen.findByRole('heading', { name: 'Saved session detail' })).toBeInTheDocument(); expect(posts).toBe(1);
});
it('shows restriction reason without exposing an editor to Trainers', async () => {
  state.user.roles = ['TRAINER'];
  state.request.mockImplementation(async (path: string) => path.startsWith('/api/horses?') ? { items: [horse] } : { horseId: 7, availability: 'LIMITED', reason: 'Walk only', exerciseRules: [{ ruleType: 'ALLOWED', exerciseTypeNote: 'Walk' }] });
  render(<MemoryRouter initialEntries={['/medical/restrictions?horseId=7']}><RestrictionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Walk only')).toBeInTheDocument());
  expect(screen.getByText('Chỉ xem')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Lưu khả năng tập luyện' })).not.toBeInTheDocument();
});
it('preserves existing restriction rules when neither read response includes them', async () => {
  state.request.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/horses?')) return { items: [horse] };
    if (path.startsWith('/api/medical/restrictions?')) return { items: [{ id: 12, horseId: 7, level: 'LIMITED', reason: 'Walk only' }], totalPages: 1 };
    return { horseId: 7, availability: 'LIMITED', reason: 'Walk only', activeRestrictionId: 12 };
  });
  render(<MemoryRouter initialEntries={['/medical/restrictions?horseId=7']}><RestrictionsPage /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Lưu khả năng tập luyện' })).toBeDisabled();
  expect(screen.getByText('Không tải được quy tắc bài tập')).toBeInTheDocument();
  expect(state.request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});
