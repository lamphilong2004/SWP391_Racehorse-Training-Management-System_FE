import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider, useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { CurrentUser } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import type { ActivationStatus, HorseDetail } from './api/types';

// HTTP fixtures only: never database persistence or a production runtime source.
const manager: CurrentUser = { id: 201, userCode: 'FIX-CM', fullName: 'Fixture Manager', email: 'cm@fixture.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
const horse = (id = 81): HorseDetail => ({ id, horseCode: 'FIX-81', name: 'Fixture Draft', breed: null, sex: null, foaledDate: null, lifecycle: 'DRAFT', healthStatus: null, trainingAvailability: 'AVAILABLE', currentBoxCode: null, primaryPhotoUrl: null, countryOfOrigin: null, registrationNo: null, activatedAt: null, pedigree: { sire: { horseId: null, name: null }, dam: { horseId: null, name: null } }, currentOwnerships: [], currentAssignment: null, createdAt: '2026-10-19T00:00:00Z', updatedAt: null });
const checklist = (): ActivationStatus => ({ horseId: 81, horseCode: 'FIX-81', name: 'Fixture Draft', lifecycle: 'DRAFT', activatedAt: null, checklist: [
  ...(['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE'] as const).map((id) => ({ id, label: id, description: `${id} detail`, requirement: 'MANDATORY' as const, state: id === 'IDENTITY' ? 'SATISFIED' as const : 'PENDING' as const })),
  { id: 'HEAD_TRAINER_READINESS_REVIEW', label: 'Head Trainer readiness review', description: 'Recommended — does not block activation', requirement: 'RECOMMENDED', state: 'NOT_REVIEWED' },
] });
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const failure = (status: number, message = 'Fixture request failed') => new Response(JSON.stringify({ success: false, error: { code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'NOT_FOUND', message, details: [] } }), { status });
function SessionProbe() {
  const auth = useAuth();
  return <><button onClick={() => void auth.logout()}>Fixture logout</button><button onClick={() => void auth.login('second@fixture.test', 'fixture-only', false)}>Fixture switch</button></>;
}
function mount(path = '/horses', options: { role?: RoleCode; anonymous?: boolean; status?: number; offline?: boolean; setup?: boolean; store?: HorseDetail[]; create?: () => Promise<Response> } = {}) {
  const actor = { ...manager, roles: [options.role ?? 'CLUB_MANAGER'] };
  const store = options.store ?? [horse()];
  const requests: { method: string; path: string; body?: unknown }[] = [];
  let setupAvailable = options.setup ?? false;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? 'GET';
    if (path === '/api/auth/me') return ok(actor);
    if (path === '/api/auth/login') return ok({ user: { ...actor, id: 202, fullName: 'Second Manager' }, accessToken: 'fixture-second-session', tokenType: 'Bearer', expiresIn: 3600 });
    if (path === '/api/auth/logout') return new Response(null, { status: 204 });
    requests.push({ method, path: path + url.search, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
    expect(new Headers(init?.headers).get('Authorization')).toMatch(/^Bearer fixture-/);
    if (options.offline) throw new Error('network fixture');
    if (options.status) return failure(options.status);
    if (path === '/api/horses' && method === 'POST') {
      if (options.create) return options.create();
      const saved = { ...horse(82), ...JSON.parse(String(init?.body)), lifecycle: 'DRAFT' as const }; store.push(saved); return ok(saved, 201);
    }
    if (path === '/api/horses' && method === 'GET') return ok({ items: store, page: 0, size: 20, totalItems: store.length, totalPages: 1 });
    if (/^\/api\/horses\/\d+$/.test(path)) return ok(store.find((h) => h.id === Number(path.split('/')[3])) ?? horse());
    if (path === '/api/stable-boxes') return ok([
      { id: 31, boxCode: 'B-01', yard: 'Fixture yard', status: 'FREE', currentHorse: null },
      { id: 32, boxCode: 'B-02', yard: 'Fixture yard', status: 'OCCUPIED', currentHorse: { id: 91, name: 'Other fixture', horseCode: 'FIX-91' } },
    ]);
    if (!setupAvailable) return failure(404);
    if (path === '/api/admin/users') return ok({ items: [{ id: 17, userCode: 'FIX-OWN', fullName: 'Fixture Owner', email: 'owner@fixture.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' }], totalItems: 1, page: 0, size: 100, totalPages: 1 });
    if (path.endsWith('/activation-status')) return ok(checklist());
    if (path === '/api/horses/pending-activation') return ok({ items: [checklist()], totalItems: 1, totalPages: 1, page: 0, size: 50 });
    if (path.endsWith('/stable-assignments') && method === 'GET') return ok([]);
    return failure(404);
  });
  vi.stubGlobal('fetch', fetcher);
  if (!options.anonymous) authSession.save('fixture-session', 3600, false);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><SessionProbe /><RouterProvider router={router} /></AuthProvider>);
  return { router, requests, fetcher, store, restoreSetup: () => { setupAvailable = true; } };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it('enters Horse register from workspace menu, creates a DRAFT then lists/details/refreshes through HTTP fixtures', async () => {
  const state = mount('/dashboard', { store: [] });
  await userEvent.click(await screen.findByRole('link', { name: 'Horses' }));
  await userEvent.click(await screen.findByRole('link', { name: 'Register Horse' }));
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'New Fixture' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'FIX-NEW' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · New Fixture' });
  expect(screen.getByText('Horse setup unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeDisabled();
  expect(state.requests.find((r) => r.method === 'POST')).toMatchObject({ path: '/api/horses', body: { name: 'New Fixture', horseCode: 'FIX-NEW', breed: null, sex: null, foaledDate: null } });
  expect(state.requests.find((r) => r.method === 'POST')!.body).not.toHaveProperty('lifecycle');
  await userEvent.click(screen.getByRole('link', { name: 'View saved horse profile' }));
  await screen.findByRole('heading', { name: 'New Fixture' });
  await userEvent.click(screen.getByRole('link', { name: '← Back to Horses' }));
  await userEvent.click(await screen.findByRole('link', { name: /New Fixture/ }));
  await screen.findByRole('heading', { name: 'New Fixture' });
  cleanup(); mount('/horses/82', { store: state.store });
  await screen.findByRole('heading', { name: 'New Fixture' });
  expect(screen.getAllByText('DRAFT').length).toBeGreaterThan(0);
});
it('validates required identity locally and keeps inputs after duplicate-code/network errors', async () => {
  const { requests } = mount('/horses/new', { create: async () => failure(409, 'Duplicate code') });
  await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  expect(screen.getByText('Enter the horse name.')).toBeInTheDocument(); expect(requests).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'Keep my edits' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'DUPLICATE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByText('Duplicate code');
  expect(screen.getByLabelText('Horse name *')).toHaveValue('Keep my edits');
  expect(screen.getByLabelText('Horse ID *')).toHaveValue('DUPLICATE');
});
it('sends only one pending create request despite repeated submit', async () => {
  let finish!: (r: Response) => void;
  const { requests } = mount('/horses/new', { create: () => new Promise((resolve) => { finish = resolve; }) });
  await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'One request' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'ONE' } });
  const form = screen.getByRole('button', { name: 'Save Draft & Continue' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1));
  await act(async () => finish(failure(500)));
  expect(screen.getByLabelText('Horse name *')).toHaveValue('One request');
});
it('preserves deliberately edited/cleared setup fields when supporting APIs recover', async () => {
  const state = mount('/horses/81/edit');
  await screen.findByText('Horse setup unavailable');
  fireEvent.change(screen.getByLabelText('Sire *'), { target: { value: 'Draft sire' } });
  fireEvent.change(screen.getByLabelText('Dam *'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Ownership share (%)'), { target: { value: '65' } });
  expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeDisabled();
  expect(screen.getByText('Box history unavailable')).toBeInTheDocument();
  state.restoreSetup(); await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByText('Horse setup unavailable')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Sire *')).toHaveValue('Draft sire'); expect(screen.getByLabelText('Dam *')).toHaveValue('');
  expect(screen.getByLabelText('Ownership share (%)')).toHaveValue(65);
  expect(state.requests.every((r) => r.method === 'GET')).toBe(true);
});
it('shows FREE/OCCUPIED boxes without fabricating an assignment when its API is missing', async () => {
  const { requests } = mount('/horses/81/edit'); await screen.findByText('Horse setup unavailable');
  await userEvent.click(screen.getByRole('button', { name: 'Assign Stable Box' }));
  expect(await screen.findByText('B-02')).toBeInTheDocument();
  expect(screen.getByText('Occupied')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /B-02/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /B-01/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Assign Box' }));
  await screen.findByText('Box not assigned');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(requests.find((r) => r.method === 'POST')).toMatchObject({ path: '/api/horses/81/stable-assignments', body: { stableBoxId: 31 } });
});
it('renders the approved six checklist rows without a manual activation action', async () => {
  mount('/horses/pending-activation', { setup: true });
  await screen.findByText('Fixture Draft · FIX-81');
  expect(screen.getByText('PEDIGREE')).toBeInTheDocument(); expect(screen.getByText('OWNER')).toBeInTheDocument();
  expect(screen.getByText('Recommended before training — does not block activation')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Activate|Approve/ })).not.toBeInTheDocument();
});
it.each(['HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'] as const)('denies %s creating horses before business requests', async (role) => {
  const { requests } = mount('/horses/new', { role }); await screen.findByText('Access denied'); expect(requests).toHaveLength(0);
});
it.each(['WORK_RIDER', 'HORSE_OWNER'] as const)('denies %s register reads', async (role) => {
  const { requests } = mount('/horses', { role }); await screen.findByText('Access denied'); expect(requests).toHaveLength(0);
});
it.each(['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'] as const)('allows approved %s register reads', async (role) => {
  mount('/horses', { role }); await screen.findByRole('link', { name: /Fixture Draft/ });
  expect(Boolean(screen.queryByRole('link', { name: 'Register Horse' }))).toBe(role === 'CLUB_MANAGER');
});
it.each(['/horses/no-id', '/horses/0', '/horses/9007199254740992', '/horses/81?tab=clinical', '/horses/no-id/edit'])('rejects invalid %s without business HTTP', async (path) => {
  const { requests } = mount(path); await screen.findByText(/Horse not found|Invalid profile section|Horse not available/); expect(requests).toHaveLength(0);
});
it.each([403, 404, 500])('shows real HTTP%s error without sample fallback and retains session', async (status) => {
  const { requests } = mount('/horses', { status }); await screen.findByText('Horse data unavailable');
  expect(requests).toHaveLength(1); expect(authSession.read()).not.toBeNull();
  expect(screen.queryByRole('link', { name: /Fixture Draft/ })).not.toBeInTheDocument();
});
it('clears session on401 and redirects anonymous access before business HTTP', async () => {
  mount('/horses', { status: 401 }); await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' }); expect(authSession.read()).toBeNull();
  cleanup(); const { requests } = mount('/horses/new', { anonymous: true });
  await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' }); expect(requests).toHaveLength(0);
});
it('clears former Horse content when shared session switches or logs out', async () => {
  mount('/horses/81'); await screen.findByRole('heading', { name: 'Fixture Draft' });
  await userEvent.click(screen.getByRole('button', { name: 'Fixture switch' }));
  await screen.findByText('Second Manager');
  await userEvent.click(screen.getByRole('button', { name: 'Fixture logout' }));
  await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' }); expect(screen.queryByText('Fixture Draft')).not.toBeInTheDocument();
});
it('guards a dirty Register Horse form, keeps input on Continue editing and focuses the first invalid field', async () => {
  const { router } = mount('/horses/new');
  await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Horse name *')).toHaveFocus());
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'Keep me' } });
  await userEvent.click(screen.getByRole('button', { name: /Back to Horses/ }));
  expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Continue editing' }));
  expect(router.state.location.pathname).toBe('/horses/new');
  expect(screen.getByLabelText('Horse name *')).toHaveValue('Keep me');
  await userEvent.click(screen.getByRole('button', { name: /Back to Horses/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/horses'));
});
