import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../../app/router';
import { AuthProvider } from '../../../shared/auth/AuthProvider';
import { authSession } from '../../../shared/auth/authSession';
import type { RoleCode } from '../../../shared/auth/roles';

const horse = { id: 7, horseCode: 'RH-7', name: 'HTTP history horse', breed: null, sex: null, foaledDate: null, lifecycle: 'ACTIVE', healthStatus: 'FIT', trainingAvailability: 'AVAILABLE', currentBoxCode: null, primaryPhotoUrl: null, countryOfOrigin: null, registrationNo: null, activatedAt: '2026-01-01T00:00:00Z', pedigree: { sire: { horseId: null, name: null }, dam: { horseId: null, name: null } }, currentOwnerships: [], currentAssignment: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null };
const items = ['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE', 'HEAD_TRAINER_READINESS_REVIEW'];
function mount(role: RoleCode, path: string, writeStatus = 204, timelineStatus = 200) {
  authSession.save('http-history-fixture', 3600, false);
  const requests: { path: string; method: string; body: unknown }[] = []; let reviewed = false;
  const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input)); const method = init?.method ?? 'GET';
    if (url.pathname === '/api/auth/me') return ok({ id: 11, fullName: 'HTTP fixture actor', email: 'actor@fixture.test', roles: [role], accountStatus: 'ACTIVE' });
    requests.push({ path: url.pathname + url.search, method, body: init?.body });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer http-history-fixture');
    if (url.pathname === '/api/horses/7') return ok(horse);
    if (url.pathname.endsWith('/timeline')) return timelineStatus === 200 ? ok({ page: 0, size: 20, totalItems: 1, totalPages: 1, items: [{ occurredAt: '2026-10-18T06:00:00Z', eventType: 'UNMAPPED', title: 'Approved safe title', diagnosis: 'CLINICAL-SECRET', targetType: 'CASE', targetId: 99 }] }) : new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'CLINICAL-SECRET', details: [] } }), { status: timelineStatus });
    if (url.pathname.endsWith('/ownerships') || url.pathname.endsWith('/stable-assignments')) return ok([]);
    if (url.pathname.endsWith('/activation-status')) return ok({ horseId: 7, horseCode: horse.horseCode, name: horse.name, lifecycle: horse.lifecycle, activatedAt: horse.activatedAt, checklist: items.map((id, i) => ({ id, label: id, description: '', requirement: i === 5 ? 'RECOMMENDED' : 'MANDATORY', state: i === 5 ? reviewed ? 'REVIEWED' : 'NOT_REVIEWED' : 'SATISFIED' })) });
    if (url.pathname.endsWith('/readiness-review')) {
      if (writeStatus === 204) { reviewed = true; return new Response(null, { status: 204 }); }
      return new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'CLINICAL-SECRET', details: [] } }), { status: writeStatus });
    }
    throw new Error(`Unapproved endpoint ${url.pathname}`);
  }));
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return { requests, horse };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); });
describe('CORE-017 actual application API binding (HTTP fixtures only)', () => {
  it.each(['CLUB_MANAGER', 'HEAD_TRAINER'] as const)('mounts complete History for %s with exact contract reads', async (role) => {
    const { requests } = mount(role, '/horses/7?tab=history');
    await screen.findByText('Approved safe title'); await screen.findByRole('heading', { name: 'Ownership history' });
    await screen.findByRole('heading', { name: 'Stable assignment history' });
    expect(requests.map((r) => r.path).sort()).toEqual(['/api/horses/7', '/api/horses/7/ownerships', '/api/horses/7/stable-assignments', '/api/horses/7/timeline?page=0&size=20'].sort());
    expect(document.body).not.toHaveTextContent('CLINICAL-SECRET'); expect(document.body).not.toHaveTextContent('UNMAPPED');
    expect(document.querySelector('a[href*="99"]')).toBeNull(); expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  });
  it.each(['TRAINER', 'GROOM', 'VETERINARIAN'] as const)('does not request restricted histories for %s', async (role) => {
    const { requests } = mount(role, '/horses/7?tab=history'); await screen.findByText('Approved safe title');
    expect(requests.some((r) => /ownerships|stable-assignments/.test(r.path))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Record readiness review' })).not.toBeInTheDocument();
  });
  it('records bodyless HT readiness 204, rereads checklist and never manually activates the horse', async () => {
    const { requests } = mount('HEAD_TRAINER', '/horses/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Record readiness review' }));
    await screen.findByText('Readiness review recorded'); await screen.findByText('Reviewed · non-blocking');
    expect(requests.filter((r) => r.method !== 'GET')).toEqual([{ path: '/api/horses/7/readiness-review', method: 'POST', body: undefined }]);
    expect(requests.filter((r) => r.path.endsWith('/activation-status'))).toHaveLength(2);
    expect(horse.lifecycle).toBe('ACTIVE'); expect(screen.queryByRole('button', { name: /Approve|Activate horse/ })).not.toBeInTheDocument();
    expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  });
  it.each([403, 500])('does not claim successful readiness for HTTP %s', async (status) => {
    mount('HEAD_TRAINER', '/horses/7', status); await userEvent.click(await screen.findByRole('button', { name: 'Record readiness review' }));
    await screen.findByText(status === 403 ? 'Only the Head Trainer can record this review.' : 'Review was not confirmed. Try again later.');
    expect(screen.queryByText('Readiness review recorded')).not.toBeInTheDocument(); expect(document.body).not.toHaveTextContent('CLINICAL-SECRET');
  });
  it('shows API timeline failure rather than substituting sample history', async () => {
    mount('HEAD_TRAINER', '/horses/7?tab=history', 204, 500); await screen.findByText('History unavailable');
    expect(screen.queryByText('Approved safe title')).not.toBeInTheDocument(); expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  });
});
