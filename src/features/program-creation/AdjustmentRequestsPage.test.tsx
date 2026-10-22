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
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Reject' }).at(-1)!);
  expect(screen.getByLabelText(/Rejection reason/)).toBeRequired();
  expect(request).not.toHaveBeenCalledWith('/api/adjustment-requests/7/reject', expect.anything());
  fireEvent.change(screen.getByLabelText(/Rejection reason/), { target: { value: 'Keep the approved phase dates' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Reject' }).at(-1)!);
  await screen.findByRole('heading', { name: 'Program Adjustment Requests' });
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/api/adjustment-requests/7/reject', { method: 'POST', body: JSON.stringify({ decisionReason: 'Keep the approved phase dates' }) }));
});

it('Trainer sees requests read-only without decision controls', async () => {
  roles.value = ['TRAINER'];
  request.mockResolvedValue(page([pending]));
  mount();
  expect(await screen.findByText('Extend Base by one week')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
});
