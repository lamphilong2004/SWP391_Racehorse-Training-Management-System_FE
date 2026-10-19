import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { CurrentUser } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';

// HTTP fixtures exercise the actual app router, session restore and API binding; not Backend/SQL evidence.
const owner: CurrentUser = { id: 17, userCode: 'OW-17', email: 'owner@fixture.test', fullName: 'Fixture Owner', accountStatus: 'ACTIVE', roles: ['HORSE_OWNER'] };
const horse = { id: 7, horseCode: 'RH-7', name: 'API owned horse', lifecycle: 'ACTIVE', trainingAvailability: 'AVAILABLE', healthStatus: null };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
function mount(path = '/owner/horses', options: { role?: RoleCode; anonymous?: boolean; status?: number; malformed?: boolean; offline?: boolean } = {}) {
  const user = { ...owner, roles: [options.role ?? 'HORSE_OWNER'] };
  if (!options.anonymous) authSession.save('http-owner-fixture', 3600, false);
  const requests: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/auth/me') return ok(user);
    requests.push(url.pathname + url.search);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer http-owner-fixture');
    expect(init?.method).toBe('GET');
    if (options.offline) throw new Error('offline');
    if (options.status) return new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'CLINICAL-SECRET', details: [] } }), { status: options.status });
    if (url.pathname === '/api/owner/horses') return ok(options.malformed ? { items: [horse] } : [horse]);
    if (url.pathname.endsWith('/profile')) return ok({ horse, pedigree: { sire: { name: 'Sire' }, dam: {} }, myOwnership: { sharePercentage: 60, effectiveFrom: '2026-01-01', isManagingOwner: true }, diagnosis: 'CLINICAL-SECRET' });
    if (url.pathname.endsWith('/health-summary')) return ok({ healthStatus: null, trainingAvailability: 'AVAILABLE', weights: [], diagnosis: 'CLINICAL-SECRET' });
    if (url.pathname.endsWith('/training-summary')) return ok({ currentProgram: null, recentSessions: [], feedback: 'CLINICAL-SECRET' });
    throw new Error(`Unapproved request ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return { router, requests, fetcher };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); });
describe('CORE-056 actual application HTTP route mounting', () => {
  it('mounts the canonical list from an array and navigates to all read-only tabs through the real provider', async () => {
    const { requests } = mount();
    await screen.findByRole('heading', { name: 'API owned horse' });
    await userEvent.click(screen.getByRole('link', { name: /View horse/ }));
    await screen.findByRole('heading', { name: 'Profile' });
    await userEvent.click(screen.getByRole('tab', { name: 'Health & Readiness' }));
    await screen.findByText('A summary for owners. Updated by the club’s Veterinarian.');
    await userEvent.click(screen.getByRole('tab', { name: 'Training & Performance' }));
    await screen.findByRole('heading', { name: 'Recent sessions' });
    expect(requests).toEqual(['/api/owner/horses', '/api/owner/horses/7/profile', '/api/owner/horses/7/health-summary', '/api/owner/horses/7/training-summary']);
    expect(document.body).not.toHaveTextContent('CLINICAL-SECRET');
    expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
    expect(screen.queryByRole('button', { name: /Save|Edit|Activate/ })).not.toBeInTheDocument();
  });
  it.each(['/owner/horses/7?tab=health', '/my-horses/7?tab=health#summary'])('supports refresh/direct-link %s and legacy canonicalization', async (path) => {
    const { router } = mount(path);
    await screen.findByText('A summary for owners. Updated by the club’s Veterinarian.');
    expect(router.state.location.pathname).toBe('/owner/horses/7');
    expect(router.state.location.search).toBe('?tab=health');
    expect(router.state.location.hash).toBe(path.includes('#') ? '#summary' : '');
  });
  it('preserves local list search through the legacy list link', async () => {
    const { router } = mount('/my-horses?q=API'); await screen.findByRole('heading', { name: 'API owned horse' });
    expect(router.state.location.pathname).toBe('/owner/horses'); expect(router.state.location.search).toBe('?q=API');
  });
  it.each(['CLUB_MANAGER', 'HEAD_TRAINER', 'GROOM', 'VETERINARIAN', 'TRAINER', 'WORK_RIDER'] as const)('denies %s before any Owner HTTP request', async (role) => {
    const { requests } = mount('/owner/horses/7?tab=health', { role });
    await screen.findByText('Access denied'); expect(requests).toEqual([]);
  });
  it.each(['/my-horses', '/my-horses/7?tab=health'])('denies a staff legacy link %s before redirecting or reading Owner data', async (path) => {
    const { router, requests } = mount(path, { role: 'HEAD_TRAINER' });
    await screen.findByText('Access denied');
    expect(router.state.location.pathname).toBe(path.split('?')[0]); expect(requests).toEqual([]);
  });
  it('uses shared login for an anonymous deep link, retaining return-location state', async () => {
    const { requests, router } = mount('/owner/horses/7?tab=training', { anonymous: true });
    await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' });
    expect(router.state.location.state.from.search).toBe('?tab=training'); expect(requests).toEqual([]);
  });
  it.each([403, 404])('halts detail authorization at profile HTTP %s without requesting summaries', async (status) => {
    const { requests } = mount('/owner/horses/7?tab=health', { status });
    await screen.findByText(status === 403 ? 'Access denied' : 'Horse not found');
    expect(requests).toEqual(['/api/owner/horses/7/profile']); expect(document.body).not.toHaveTextContent('CLINICAL-SECRET');
  });
  it('clears the shared session on Owner 401', async () => {
    mount('/owner/horses/7', { status: 401 }); await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' });
    await waitFor(() => expect(authSession.read()).toBeNull());
  });
  it.each([{ status: 500 }, { offline: true }, { malformed: true }])('keeps API failures visible without sample fallback: %j', async (options) => {
    const { requests } = mount('/owner/horses', options);
    await screen.findByText('Owner information unavailable');
    expect(requests).toEqual(['/api/owner/horses']); expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
    expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  });
});
