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

it.each(['/medical/cases/no-such-id', '/medical/cases/0', '/medical/cases/no-such-id/treatment-plan'])('renders not-found for invalid route %s without a medical request', async (path) => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    throw new Error(`Unexpected medical request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount(path);
  expect(await screen.findByText('Medical case not found')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('logs in through shared login and opens cases from the existing workspace navigation', async () => {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    void _init;
    if (url.endsWith('/api/auth/login')) return ok({ accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 3600, user: vet });
    if (url.includes('/api/medical/cases?')) return ok(page([medicalCase]));
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = mount('/medical');
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: vet.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  // Current dev PublicOnly redirects to the role workspace; return-path auth remediation is owned separately.
  await screen.findByRole('heading', { name: 'Veterinary Workspace' });
  fireEvent.click(screen.getByRole('link', { name: 'Medical / Health' }));
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
  expect(await screen.findByText('Access denied')).toBeInTheDocument();
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
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
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
  expect(await screen.findByText('Access Denied: No case-list permission')).toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe('jwt');
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes('/api/medical/')) return fail(401, 'UNAUTHORIZED', 'Token expired');
    if (url.endsWith('/api/auth/me')) return ok(vet);
    throw new Error(`Unexpected request: ${url}`);
  });
  await router.navigate('/medical/herd-health');
  await waitFor(() => expect(authSession.read()).toBeNull());
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
});

it('blocks an inactive restored account before mounting clinical pages and permits explicit sign-out', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok({ ...vet, accountStatus: 'INACTIVE' });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical');
  expect(await screen.findByText('Workspace unavailable')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Medical Cases')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull();
  // The shared AuthProvider attempts its existing server logout; no clinical request is made.
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/api/medical/'))).toHaveLength(0);
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
  fireEvent.click(await screen.findByRole('tab', { name: 'Examination' }));
  fireEvent.change(screen.getByLabelText('Symptoms and findings'), { target: { value: 'Left foreleg lame' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save examination' }));
  expect(await screen.findByText('Case was closed by another Vet')).toBeInTheDocument();
  expect(screen.getByLabelText('Symptoms and findings')).toHaveValue('Left foreleg lame');
  expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
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
  expect(screen.getByLabelText('Groom-safe instruction 1')).toHaveValue('Cold compress');
  expect(screen.queryByLabelText('Groom-safe instruction 2')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: /Treatment and medication instructions/ }), { target: { value: 'Rest and inspect' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  expect(await screen.findByText('Assignment source unavailable')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Treatment and medication instructions/ })).toHaveValue('Rest and inspect');
  const request = fetcher.mock.calls.find(([url, init]) => url.endsWith('/treatment-plan') && init?.method === 'PUT')?.[1];
  expect(JSON.parse(String(request?.body)).groomTasks).toEqual([{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-17' }]);
});

it('does not show case closure success when the backend returns 409', async () => {
  authSession.save('jwt', 3600, false);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return ok(vet);
    if (url.endsWith('/api/medical/cases/9') && init?.method === 'GET') return ok(medicalCase);
    if (url.endsWith('/api/horses/14/training-availability')) return ok({ horseId: 14, availability: 'AVAILABLE' });
    if (url.includes('/treatment-tasks')) return ok(page([]));
    if (url.endsWith('/api/medical/cases/9/close')) return fail(409, 'CONFLICT', 'Linked incident remains unresolved');
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  mount('/medical/cases/9');
  fireEvent.click(await screen.findByRole('button', { name: 'Close case' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  expect(await screen.findByText('Linked incident remains unresolved')).toBeInTheDocument();
  expect(screen.getByText('Close case 9?')).toBeInTheDocument();
});
