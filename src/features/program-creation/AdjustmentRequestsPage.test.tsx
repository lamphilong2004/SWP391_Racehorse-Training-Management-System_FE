import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AdjustmentRequestsPage } from './AdjustmentRequestsPage';

const request = vi.hoisted(() => vi.fn());
const roles = vi.hoisted(() => ({ value: ['HEAD_TRAINER'] }));
vi.mock('../main-flows/api', async (load) => ({ ...await load<object>(), useFlowRequest: () => request }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 2, fullName: 'Head fixture', roles: roles.value }, handleApiError: vi.fn(), logout: vi.fn() }) }));
vi.mock('../main-flows/FlowShell', () => ({ FlowShell: ({ title, children }: { title: string; children: React.ReactNode }) => <main><h1>{title}</h1>{children}</main> }));

const pending = { id: 7, programId: 9, requestType: 'PHASE_TIMELINE', requestedValue: 'Extend Base by one week', reason: 'Slow recovery', status: 'PENDING',
  requestedBy: { id: 3, fullName: 'Trainer fixture' }, requestedAt: '2026-10-22T07:00:00Z', horse: { id: 11, horseCode: 'RH-1', name: 'Fixture Horse' } };
const page = (items: unknown[]) => ({ items, page: 0, size: 20, totalItems: items.length, totalPages: 1 });
function mount() {
  render(<RouterProvider router={createMemoryRouter([{ path: '/training/adjustment-requests', element: <AdjustmentRequestsPage /> }], { initialEntries: ['/training/adjustment-requests'] })} />);
}
beforeEach(() => { request.mockReset(); roles.value = ['HEAD_TRAINER']; });

it('Head Trainer must give a reason to reject and the decision calls the reject endpoint once', async () => {
  request.mockImplementation(async (path: string) => path.startsWith('/api/adjustment-requests?') ? page([pending]) : { ...pending, status: 'REJECTED' });
  mount();
  expect(request).toHaveBeenCalledWith('/api/adjustment-requests?page=0&size=20&status=PENDING', expect.anything());
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Từ chối' }).at(-1)!);
  expect(screen.getByLabelText(/Lý do từ chối/)).toBeRequired();
  expect(request).not.toHaveBeenCalledWith('/api/adjustment-requests/7/reject', expect.anything());
  fireEvent.change(screen.getByLabelText(/Lý do từ chối/), { target: { value: 'Keep the approved phase dates' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Từ chối' }).at(-1)!);
  await screen.findByRole('heading', { name: 'Yêu cầu điều chỉnh chương trình' });
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/api/adjustment-requests/7/reject', { method: 'POST', body: JSON.stringify({ decisionReason: 'Keep the approved phase dates' }) }));
});

it('Trainer sees requests read-only without decision controls', async () => {
  roles.value = ['TRAINER'];
  request.mockResolvedValue(page([pending]));
  mount();
  expect(await screen.findByText('Extend Base by one week')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument();
});

const approved = { ...pending, status: 'APPROVED', reviewedBy: { id: 2, fullName: 'Head fixture' }, reviewedAt: '2026-10-22T08:00:00Z' };
const program = { id: 9, horse: { id: 11, horseCode: 'RH-1', name: 'Fixture Horse' }, name: 'Base block', status: 'ACTIVE', periodStart: '2026-10-01', periodEnd: '2026-10-31', sourceTemplateId: 1, sourceTemplateVersion: 1, activatedAt: '2026-10-01T00:00:00Z',
  phases: [{ id: 41, templateVersionPhaseId: 5, phaseOrder: 1, name: 'Base', objective: 'Aerobic base', startDate: '2026-10-01', endDate: '2026-10-14', intensityMin: 'LOW', intensityMax: 'MEDIUM', workload: 'Walk/trot', isCustomized: false },
    { id: 42, templateVersionPhaseId: 6, phaseOrder: 2, name: 'Build', objective: null, startDate: '2026-10-15', endDate: '2026-10-31', intensityMin: null, intensityMax: null, workload: null, isCustomized: false }] };
function applyFixture(history: unknown[] = []) {
  request.mockImplementation(async (path: string) => path.startsWith('/api/adjustment-requests?') ? page([approved])
    : path === '/api/training-programs/9' ? program : path === '/api/training-programs/9/history' ? history : path === '/api/training-programs/9/phases' ? program : undefined);
}

it('Head Trainer applies an approved request to the phases with the request id', async () => {
  applyFixture(); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Áp dụng vào giai đoạn' }));
  fireEvent.change(await screen.findByLabelText(/^Giai đoạn 1 — ngày kết thúc/), { target: { value: '2026-10-21' } });
  fireEvent.change(screen.getByLabelText(/^Giai đoạn 2 — ngày bắt đầu/), { target: { value: '2026-10-22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng vào chương trình' }));
  expect(await screen.findByText('Đã áp dụng điều chỉnh')).toBeInTheDocument();
  const call = request.mock.calls.find(([path]) => path === '/api/training-programs/9/phases')!;
  const body = JSON.parse(call[1].body);
  expect(call[1].method).toBe('PUT'); expect(body.adjustmentRequestId).toBe(7);
  expect(body.phases.map((phase: { id: number; phaseOrder: number; startDate: string; endDate: string }) => [phase.id, phase.phaseOrder, phase.startDate, phase.endDate]))
    .toEqual([[41, 1, '2026-10-01', '2026-10-21'], [42, 2, '2026-10-22', '2026-10-31']]);
});

it('blocks overlapping or out-of-period phases before any write and warns when already applied', async () => {
  applyFixture([{ occurredAt: '2026-10-22T09:00:00Z', entryType: 'PROGRAM_PHASES_ADJUSTED', summary: 'Program phase structure adjusted. Applied approved request 7.' }]); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Áp dụng vào giai đoạn' }));
  expect(await screen.findByText('Đã áp dụng trước đó')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Giai đoạn 2 — ngày bắt đầu/), { target: { value: '2026-10-10' } });
  fireEvent.change(screen.getByLabelText(/^Giai đoạn 2 — ngày kết thúc/), { target: { value: '2026-11-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng vào chương trình' }));
  expect(await screen.findByText('Ngày bắt đầu phải sau khi giai đoạn trước kết thúc.')).toBeInTheDocument();
  expect(screen.getByText('Ngày kết thúc phải nằm trong thời gian chương trình.')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith('/api/training-programs/9/phases', expect.anything());
});

it('offers Apply only to the Head Trainer on approved requests', async () => {
  roles.value = ['TRAINER']; request.mockResolvedValue(page([approved])); mount();
  expect(await screen.findByText('Extend Base by one week')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Áp dụng vào giai đoạn' })).not.toBeInTheDocument();
});
