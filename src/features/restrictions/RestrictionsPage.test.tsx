import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { RestrictionsPage } from './RestrictionsPage';

const fixture = vi.hoisted(() => ({ roles: ['VETERINARIAN'], request: vi.fn() }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { roles: fixture.roles } }) }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => fixture.request }));
vi.mock('../main-flows/FlowShell', () => ({ FlowShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('./ThresholdOverride', () => ({ ThresholdOverride: () => null }));

beforeEach(() => {
  fixture.roles = ['VETERINARIAN'];
  let active = true;
  fixture.request.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/medical/restrictions/12/lift' && init?.method === 'POST') {
      active = false;
      return { id: 12 };
    }
    if (path.includes('training-availability')) return { horseId: 6, availability: active ? 'LOCKED' : 'AVAILABLE', activeRestrictionId: active ? 12 : undefined };
    if (path.startsWith('/api/medical/restrictions?')) return { items: [{ id: 12, effectiveAt: '2026-11-02T18:32:32.661Z', reviewDate: '2026-11-05' }] };
    return { items: [{ id: 6, name: 'Hải Đăng', horseCode: 'RH-006' }], totalPages: 1 };
  });
});

function mount() {
  render(<MemoryRouter initialEntries={['/medical/restrictions?horseId=6']}><RestrictionsPage /></MemoryRouter>);
}

it('shows Vietnam dates and requires explicit confirmation before lifting', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Gỡ hạn chế' }));
  const dialog = screen.getByRole('dialog', { name: 'Gỡ hạn chế tập luyện?' });
  expect(dialog).toHaveTextContent('Tình trạng sức khỏe vẫn giữ nguyên');
  expect(screen.getByText('03/11/2026 · 01:32')).toBeInTheDocument();
  expect(screen.getByText('05/11/2026')).toBeInTheDocument();
  expect(screen.getByText('Được phép')).toBeInTheDocument();
  expect(screen.getByText('Bị cấm')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
  expect(fixture.request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Gỡ hạn chế' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gỡ hạn chế' }));
  expect(await screen.findByText('Đã gỡ hạn chế tập luyện')).toBeInTheDocument();
  expect(await screen.findByText('Sẵn sàng')).toBeInTheDocument();
  expect(fixture.request).toHaveBeenCalledWith('/api/medical/restrictions/12/lift', { method: 'POST', body: '{}' });
});

it('shows restrictions read-only for a Trainer', async () => {
  fixture.roles = ['TRAINER'];
  mount();
  expect(await screen.findByText('03/11/2026 · 01:32')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Gỡ hạn chế' })).not.toBeInTheDocument();
});
