import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';

const vet = { id: 7, userCode: 'V-7', fullName: 'Vet', email: 'vet@example.test', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' };
const groom = { ...vet, id: 6, userCode: 'G-6', fullName: 'Groom', roles: ['GROOM'] };
const trainer = { ...vet, id: 8, userCode: 'T-8', fullName: 'Trainer', roles: ['TRAINER'] };
const medicalCase = { id: 9, horseId: 14, status: 'OPEN', openedAt: '2026-10-16T01:00:00Z', reason: 'Lameness', incidentIds: [], examinations: [], injuries: [], reexaminations: [] };
const page = (items: unknown[]) => ({ items, page: 0, size: 20, totalElements: items.length });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status: number, code: string, message: string) => new Response(JSON.stringify({ success: false, error: { code, message, details: [] } }), { status });

function mount(path: string) {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return router;
}

afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });

it('selects a real horse by name/code for a new medical case and retains the draft after a rejected save', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.includes('/api/horses?')) return ok({ items: [{ id: 14, name: 'Same horse name', horseCode: 'H-14' }, { id: 15, name: 'Same horse name', horseCode: 'H-15' }], page: 0, size: 20, totalItems: 2, totalPages: 1 });
    if (url.endsWith('/api/medical/cases') && init?.method === 'POST') return fail(409, 'CONFLICT', 'Case changed; retry.');
    throw new Error('Unexpected case-picker fixture request');
  });
  vi.stubGlobal('fetch', fetcher);mount('/medical/cases/new');
  fireEvent.change(await screen.findByLabelText('Lý do'), { target: { value: 'Observation requiring review' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo ca' }));
  expect(await screen.findByText('Ngựa là bắt buộc')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngựa' }));
  await screen.findByRole('option', { name: 'Same horse name · H-15' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Hồ sơ ngựa' }), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Dùng hồ sơ đã chọn' }));
  expect(screen.getByLabelText('Ngựa')).toHaveValue('Same horse name · H-15');
  expect(screen.getByLabelText('Ngựa')).toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo ca' }));
  await screen.findByText('Case changed; retry.');
  expect(screen.getByLabelText('Lý do')).toHaveValue('Observation requiring review');
  expect(screen.getByLabelText('Ngựa')).toHaveValue('Same horse name · H-15');
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ horseId: 15, reason: 'Observation requiring review' });
});

it('shows horse lookup errors honestly and does not let an unselected case submit', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => url.endsWith('/api/auth/me') ? ok(vet) : fail(503, 'SERVICE_UNAVAILABLE', 'Horse lookup unavailable'));
  vi.stubGlobal('fetch', fetcher);mount('/medical/cases/new');
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn ngựa' }));
  expect(await screen.findByText('Horse lookup unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dùng hồ sơ đã chọn' })).toBeDisabled();
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  expect(fetcher.mock.calls.every(([url]) => !url.endsWith('/api/medical/cases'))).toBe(true);
});

it('shows the next examination as a local calendar date rather than a raw ISO date', async () => {
  authSession.save('jwt', 3600, false);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9')) return ok({ ...medicalCase, treatmentPlan: { id: 3, caseId: 9, createdAt: '2026-10-19T00:00:00Z', treatmentMedicationInstructions: 'Observation fixture', reexaminationDate: '2026-10-27' } });
    if (url.endsWith('/api/horses/14')) return ok({ id: 14, horseCode: 'ST-014', name: 'Storm', lifecycle: 'ACTIVE', healthStatus: 'MONITORING', trainingAvailability: 'LIMITED' });
    throw new Error('Unexpected fixture request');
  }));
  mount('/medical/cases/9');expect((await screen.findAllByText('27/10/2026')).length).toBeGreaterThan(0);expect(screen.queryByText('2026-10-27')).not.toBeInTheDocument();
});

it.each(['/medical/cases/no-such-id', '/medical/cases/0', '/medical/cases/no-such-id/treatment-plan'])('renders not-found for invalid route %s without a medical request', async (path) => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    throw new Error(`Unexpected medical request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount(path);
  expect(await screen.findByText('Không tìm thấy ca y tế')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('logs in and opens the clinical case list from the canonical router', async () => {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    void _init;
    if (url.endsWith('/api/auth/login')) return ok({ accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 3600, user: vet });
    if (url.includes('/api/medical/cases?')) return ok(page([medicalCase]));
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = mount('/medical');
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: vet.email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(await screen.findByText('Lameness')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/medical');
  expect(new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).get('Authorization')).toBe('Bearer jwt');
});

it.each([groom, trainer])('denies clinical routes to $fullName without a medical request', async (user) => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(user);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9');
  expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('restores a Vet and clears clinical data after sign-out', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.includes('/api/medical/cases?')) return ok(page([medicalCase]));
    if (url.endsWith('/api/auth/logout')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = mount('/medical');
  expect(await screen.findByText('Lameness')).toBeInTheDocument();
  await router.navigate('/dashboard');
  await screen.findByRole('heading', { name: 'Ngựa mới đến' });
  fireEvent.click(screen.getByRole('button', { name: 'Menu tài khoản' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Đăng xuất' }));
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(screen.queryByText('Lameness')).not.toBeInTheDocument();
  expect(authSession.read()).toBeNull();
});

it('clears a Vet session on medical 401 and keeps it on ordinary 403', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.includes('/api/medical/cases?')) return fail(403, 'FORBIDDEN', 'No case-list permission');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = mount('/medical');
  expect(await screen.findByText('Không có quyền truy cập: No case-list permission')).toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe('jwt');
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes('/api/medical/')) return fail(401, 'UNAUTHORIZED', 'Token expired');
    if (url.endsWith('/api/auth/me')) return ok(vet);
    throw new Error(`Unexpected request: ${url}`);
  });
  await router.navigate('/medical/herd-health');
  await waitFor(() => expect(authSession.read()).toBeNull());
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
});

it('drops an inactive restored account before mounting clinical pages', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok({ ...vet, accountStatus: 'INACTIVE' });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical');
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps examination input and shows the backend 409 reason through the case route', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9') && init?.method === 'GET') return ok(medicalCase);
    if (url.endsWith('/api/horses/14/training-availability')) return ok({ horseId: 14, availability: 'AVAILABLE' });
    if (url.includes('/treatment-tasks')) return ok(page([]));
    if (url.endsWith('/api/medical/cases/9/examinations')) return fail(409, 'CONFLICT', 'Case was closed by another Vet');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9');
  fireEvent.click(await screen.findByRole('tab', { name: 'Khám' }));
  fireEvent.change(screen.getByLabelText('Triệu chứng và phát hiện'), { target: { value: 'Left foreleg lame' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lần khám' }));
  expect(await screen.findByText('Case was closed by another Vet')).toBeInTheDocument();
  expect(screen.getByLabelText('Triệu chứng và phát hiện')).toHaveValue('Left foreleg lame');
  expect(screen.queryByText('Đã lưu thành công')).not.toBeInTheDocument();
  expect(JSON.parse(String(fetcher.mock.calls.find(([url]) => url.endsWith('/examinations'))?.[1]?.body))).toMatchObject({ symptoms: 'Left foreleg lame' });
});

it('keeps a blocked treatment edit and shows completed task history', async () => {
  authSession.save('jwt', 3600, false);
  const withPlan = { ...medicalCase, treatmentPlan: { id: 3, caseId: 9, treatmentMedicationInstructions: 'Rest protocol', createdAt: '2026-10-16T01:00:00Z' } };
  const tasks = [
    { id: 1, caseId: 9, treatmentPlanId: 3, horseId: 14, assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-17', status: 'PENDING' },
    { id: 2, caseId: 9, treatmentPlanId: 3, horseId: 14, assignedGroomUserId: 6, instruction: 'Walk completed', taskDate: '2026-10-16', status: 'COMPLETED' },
  ];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9') && init?.method === 'GET') return ok(withPlan);
    if (url.includes('/treatment-tasks')) return ok(page(tasks));
    if (url.endsWith('/api/horses/14/training-availability')) return ok({ horseId: 14, availability: 'AVAILABLE' });
    if (url.endsWith('/treatment-plan') && init?.method === 'PUT') return fail(409, 'BUSINESS_RULE_VIOLATION', 'Assignment source unavailable');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9/treatment-plan');
  expect(await screen.findByText('Walk completed')).toBeInTheDocument();
  expect(screen.getByLabelText('Hướng dẫn cho Groom 1')).toHaveValue('Cold compress');
  expect(screen.getByLabelText('Hướng dẫn cho Groom 2')).toHaveValue('Walk completed');
  expect(screen.getByLabelText('Hướng dẫn cho Groom 2')).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /Hướng dẫn điều trị và dùng thuốc/ }), { target: { value: 'Rest and inspect' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu phác đồ điều trị' }));
  expect(await screen.findByText('Assignment source unavailable')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Hướng dẫn điều trị và dùng thuốc/ })).toHaveValue('Rest and inspect');
  const request = fetcher.mock.calls.find(([url, init]) => url.endsWith('/treatment-plan') && init?.method === 'PUT')?.[1];
  expect(JSON.parse(String(request?.body)).groomTasks).toEqual([
    { assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-17' },
    { assignedGroomUserId: 6, instruction: 'Walk completed', taskDate: '2026-10-16' },
  ]);
});

it('does not show case closure success when the backend returns 409', async () => {
  authSession.save('jwt', 3600, false);
  const examined = { ...medicalCase, examinations: [{ id: 1, caseId: 9, horseId: 14, examinedAt: '2026-10-16T02:00:00Z' }] };
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9') && init?.method === 'GET') return ok(examined);
    if (url.endsWith('/api/horses/14/training-availability')) return ok({ horseId: 14, availability: 'AVAILABLE' });
    if (url.includes('/treatment-tasks')) return ok(page([]));
    if (url.includes('/api/medical/restrictions?')) return ok(page([]));
    if (url.endsWith('/api/medical/cases/9/close')) return fail(409, 'CONFLICT', 'Linked incident remains unresolved');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9');
  expect(await screen.findByText('Ca đã đủ điều kiện đóng.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng ca' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng ca' }));
  expect(await screen.findByText('Linked incident remains unresolved')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/close'))).toHaveLength(1);
});

it('lists an unresolved linked incident as a closure blocker with an inline resolve action', async () => {
  authSession.save('jwt', 3600, false);
  const linked = { ...medicalCase, incidentIds: [7], examinations: [{ id: 1, caseId: 9, horseId: 14, examinedAt: '2026-10-16T02:00:00Z' }] };
  let incidentStatus = 'UNDER_REVIEW';
  const incident = () => ({ id: 7, incidentCode: 'INC-0007', horseId: 14, reportedByUserId: 5, medicalCaseId: 9, incidentType: 'LAMENESS', observedSeverity: 'MEDIUM', description: 'Uneven gait', observedAt: '2026-10-16T01:00:00Z', reportedAt: '2026-10-16T01:00:00Z', status: incidentStatus });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9') && init?.method === 'GET') return ok(linked);
    if (url.endsWith('/api/horses/14/training-availability')) return ok({ horseId: 14, availability: 'AVAILABLE' });
    if (url.includes('/api/medical/restrictions?')) return ok(page([]));
    if (url.endsWith('/api/incidents/7/review')) { incidentStatus = 'RESOLVED'; return ok(incident()); }
    if (url.endsWith('/api/incidents/7')) return ok(incident());
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9');
  expect(await screen.findByText('1 sự cố chưa đóng.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đóng ca' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng sự cố' }));
  expect(await screen.findByText('Ca đã đủ điều kiện đóng.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đóng ca' })).toBeEnabled();
});

it('filters only the loaded case page and resets both search and status without a business mutation', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.includes('/api/medical/cases?')) return ok(page([
      medicalCase, { ...medicalCase, id: 10, status: 'CLOSED', reason: 'Recovery observation' },
    ]));
    throw new Error(`Unexpected request: ${url} ${init?.method}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical');
  await screen.findByRole('link', { name: 'Ca #9' });
  fireEvent.change(screen.getByLabelText('Trạng thái trên trang'), { target: { value: 'CLOSED' } });
  expect(screen.queryByRole('link', { name: 'Ca #9' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ca #10' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm trên trang hiện tại'), { target: { value: 'Lameness' } });
  expect(screen.getByText('Không có ca phù hợp bộ lọc')).toBeInTheDocument();
  expect(screen.getByText('Chỉ lọc dữ liệu trên trang đang tải')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(screen.getByRole('link', { name: 'Ca #9' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ca #10' })).toBeInTheDocument();
  expect(screen.getByLabelText('Trạng thái trên trang')).toHaveValue('');
  expect(screen.getByLabelText('Tìm trên trang hiện tại')).toHaveValue('');
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});
