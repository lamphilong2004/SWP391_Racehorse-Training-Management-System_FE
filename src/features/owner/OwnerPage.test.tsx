import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from '../../shared/auth/AuthProvider';
import { ApiError, type AuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES } from '../../shared/auth/roles';
import { OwnerProvider } from './OwnerProvider';
import { ownerRoutes } from './ownerRoutes';
import { createOwnerSampleTransport, ownerContractPending } from './ownerSampleTransport';
import { canonicalFixture, ownerA, ownerB } from './ownerFixtures.test-support';
import type { OwnerHorse, OwnerService } from './ownerModel';

function FixtureSession() {
  const auth = useAuth();
  return <><button onClick={() => void auth.login(ownerB.email, 'fixture-only', false)}>Fixture login B</button><button onClick={() => void auth.logout()}>Fixture logout</button></>;
}
function mount(path = '/owner/horses', options: { user?: CurrentUser | null; service?: OwnerService; noBinding?: boolean } = {}) {
  localStorage.clear(); sessionStorage.clear();
  let actor = options.user === undefined ? ownerA : options.user;
  if (actor) authSession.save('unit-owner-session', 3600, false);
  const snapshot = canonicalFixture();
  const readSamples = vi.fn(() => snapshot);
  const service = options.service ?? createOwnerSampleTransport({ readSamples, getBusinessActor: () => actor }, () => new Date('2026-10-18T00:00:00Z'));
  const api: AuthApi = { async currentUser() { return actor!; }, async login(input) { actor = input.email === ownerB.email ? ownerB : ownerA; return { user: actor, accessToken: `unit-owner-${actor.id}`, tokenType: 'Bearer', expiresIn: 3600 }; }, async logout() { actor = null; } };
  const router = createMemoryRouter([...ownerRoutes, { path: '/login', element: <h1>Shared login</h1> }, { path: '/dashboard', element: <h1>Existing workspace</h1> }], { initialEntries: [path] });
  const content = <><FixtureSession /><RouterProvider router={router} /></>;
  render(<AuthProvider api={api}>{options.noBinding ? content : <OwnerProvider service={service}>{content}</OwnerProvider>}</AuthProvider>);
  return { router, service, readSamples, snapshot };
}
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe('CORE-056 read-only Owner journey', () => {
  it('lists only owned horses and opens the approved profile/health/training tabs', async () => {
    mount(); await screen.findByRole('heading', { name: 'My Horses' });
    expect(screen.getByRole('heading', { name: 'Thunder Bolt' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Ocean Pride' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /View horse/ }));
    await screen.findByRole('heading', { name: 'Profile' });
    expect(screen.getByText('Northern Star')).toBeInTheDocument(); expect(screen.getByText('READ-ONLY')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Health & Readiness' }));
    await screen.findByText('A summary for owners. Updated by the club’s Veterinarian.');
    expect(screen.getByText(/Clinical details such as diagnosis/)).toBeInTheDocument();
    expect(screen.queryByText('512 kg')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Training & Performance' }));
    await screen.findByRole('heading', { name: 'Current training program' });
    expect(screen.getByText('Endurance foundation')).toBeInTheDocument(); expect(screen.queryByText('58%')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: '← My Horses' }));
    await screen.findByRole('heading', { name: 'My Horses' });
  });
  it('keeps approved Profile layout read-only without extra ownership rows', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Ownership' });
    expect(screen.getByText('Thunder Bolt is linked to your account.')).toBeInTheDocument();
    expect(screen.queryByText('My share')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked since')).not.toBeInTheDocument();
    expect(screen.queryByText('Managing owner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Save|Delete/i })).not.toBeInTheDocument();
  });
  it('uses approved Health/Weight layout and real contract values without inventing progress metrics', async () => {
    const source = createOwnerSampleTransport({ readSamples: canonicalFixture, getBusinessActor: () => ownerA }, () => new Date('2026-10-18T00:00:00Z'));
    const horse = await source.detail(7, { actorId: 17 });
    const service: OwnerService = { list: source.list, async detail() { return { ...horse, healthSummary: { reviewDate: '2026-10-25', recovery: 'IMPROVING', examinedAt: '2026-10-17T06:00:00Z', weights: [{ weightKg: 501.25, recordedAt: '2026-10-18T06:00:00Z' }] }, program: { ...horse.program!, completed: 3, planned: 8 } }; } };
    mount('/owner/horses/7?tab=health', { service });
    await screen.findByText('25 Oct 2026');
    expect(screen.getByText('501.25 kg')).toBeInTheDocument();
    expect(screen.getByText(/last recorded/)).toHaveTextContent('18 Oct 2026');
    expect(screen.queryByText('Recovery')).not.toBeInTheDocument(); expect(screen.queryByText('Last examined')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Weight history' })).not.toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-18T06:00:00Z"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Training & Performance' }));
    expect(screen.getByText('3 / 8 sessions completed')).toBeInTheDocument(); expect(screen.queryByText('58%')).not.toBeInTheDocument();
  });
  it('supports direct-link health and keeps the selected tab in URL', async () => {
    const { router } = mount('/owner/horses/7?tab=health');
    await screen.findByText('No owner summary shared yet');
    expect(screen.getByRole('tab', { name: 'Health & Readiness' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Training & Performance' }));
    await screen.findByRole('heading', { name: 'Recent sessions' }); expect(router.state.location.search).toBe('?tab=training');
  });
  it('supports keyboard tab interaction using the canonical Tabs component', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Profile' });
    const profile = screen.getByRole('tab', { name: 'Profile & Pedigree' }); profile.focus();
    await userEvent.keyboard('{ArrowRight}'); await screen.findByText('No owner summary shared yet');
    expect(screen.getByRole('tab', { name: 'Health & Readiness' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Health & Readiness' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}'); await screen.findByRole('heading', { name: 'Recent sessions' });
    expect(screen.getByRole('tab', { name: 'Training & Performance' })).toHaveFocus();
  });
  it.each(['/owner/horses/8', '/owner/horses/8?tab=health', '/owner/horses/8?tab=training'])('blocks a non-owned direct link %s with no other-owner data', async (path) => {
    mount(path); await screen.findByText('Access denied'); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument(); expect(authSession.read()).not.toBeNull();
    await userEvent.click(screen.getByRole('link', { name: '← My Horses' })); await screen.findByRole('heading', { name: 'Thunder Bolt' });
  });
  it('shows not-found instead of returning another horse for an unknown id', async () => {
    mount('/owner/horses/999'); await screen.findByText('Horse not found'); expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  });
  it.each(['/owner/horses/no-id', '/owner/horses/0', '/owner/horses/7?tab=clinical', '/owner/horses/9007199254740992'])('rejects invalid link %s before transport', async (path) => {
    const { readSamples } = mount(path); await screen.findByText('Invalid horse link'); expect(readSamples).not.toHaveBeenCalled();
  });
  it.each(ROLE_CODES.filter((role) => role !== 'HORSE_OWNER'))('denies %s before reading canonical data', async (role) => {
    const { readSamples } = mount(undefined, { user: { ...ownerA, roles: [role] } });
    await screen.findByText('This portal is available to Horse Owners only.'); expect(readSamples).not.toHaveBeenCalled();
  });
  it('redirects anonymous direct-link access to shared login before data reads', async () => {
    const { readSamples } = mount('/owner/horses/7?tab=training', { user: null });
    await screen.findByRole('heading', { name: 'Shared login' }); expect(readSamples).not.toHaveBeenCalled();
  });
  it('renders empty data without auto-seeding an ownership relation', async () => {
    const { snapshot } = mount(undefined, { user: { ...ownerA, id: 100 } });
    await screen.findByText('No horses registered to you'); expect(snapshot.horseRegistry!.records).toHaveLength(2);
  });
  it('searches only the returned owned list and offers a working clear action', async () => {
    const { router } = mount(); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search my horses…' }), 'Ocean{Enter}');
    await screen.findByText('No matching horses'); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' })); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('searchbox', { name: 'Search my horses…' })).toHaveValue('');
  });
  it('shows a retryable safe error without leaking raw service details', async () => {
    const service: OwnerService = { list: vi.fn().mockRejectedValueOnce(new Error('CLINICAL-SECRET')).mockResolvedValue([]), detail: vi.fn() };
    mount(undefined, { service }); await screen.findByText('Owner information unavailable'); expect(screen.queryByText('CLINICAL-SECRET')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Try again|Retry/i })); await screen.findByText('No horses registered to you');
  });
  it('keeps real API mode pending without selecting samples or performing HTTP', async () => {
    const { readSamples } = mount(undefined, { noBinding: true });
    await screen.findByText('Owner information unavailable'); expect(readSamples).not.toHaveBeenCalled();
  });
  it('clears the shared session on API 401 rather than displaying stale Owner data', async () => {
    const service = { ...ownerContractPending, list: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Expired')) };
    mount(undefined, { service }); await screen.findByRole('heading', { name: 'Shared login' }); expect(authSession.read()).toBeNull();
  });
  it('keeps the session on ordinary 403 and does not retry denied reads', async () => {
    const service = { ...ownerContractPending, list: vi.fn().mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Denied')) };
    mount(undefined, { service }); await screen.findByText('Access denied'); expect(authSession.read()).not.toBeNull(); expect(service.list).toHaveBeenCalledOnce();
  });
  it('does not render sensitive fields added to the canonical snapshot', async () => {
    const { snapshot } = mount('/owner/horses/7?tab=training');
    Object.assign(snapshot, { cases: [{ diagnosis: 'CLINICAL-SECRET', medication: 'MEDICATION-SECRET' }] });
    Object.assign(snapshot.sessions[0], { evaluation: { notes: 'EVALUATION-SECRET' }, riderFeedback: 'FEEDBACK-SECRET' });
    await screen.findByRole('heading', { name: 'Recent sessions' }); expect(document.body).not.toHaveTextContent(/CLINICAL-SECRET|MEDICATION-SECRET|EVALUATION-SECRET|FEEDBACK-SECRET/);
    expect(screen.queryByRole('button', { name: /Edit|Save|Assign|Complete|Delete/i })).not.toBeInTheDocument();
  });
  it('replaces the visible list on session switching and clears it on logout', async () => {
    mount(); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' }));
    await screen.findByRole('heading', { name: 'Ocean Pride' }); expect(screen.queryByRole('heading', { name: 'Thunder Bolt' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fixture logout' }));
    await screen.findByRole('heading', { name: 'Shared login' }); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
  });
  it('rejects a formerly-owned direct link immediately when another Owner signs in', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' }));
    await screen.findByText('Access denied'); expect(screen.queryByRole('heading', { name: 'Thunder Bolt' })).not.toBeInTheDocument();
  });
  it('discards delayed previous-session results after switching Owner identity', async () => {
    const source = createOwnerSampleTransport({ readSamples: canonicalFixture, getBusinessActor: () => ownerA }, () => new Date('2026-10-18T00:00:00Z'));
    const rows = await source.list({ actorId: 17 }); let resolve!: (value: OwnerHorse[]) => void;
    const service: OwnerService = { list: vi.fn().mockImplementationOnce(() => new Promise<OwnerHorse[]>((done) => { resolve = done; })).mockResolvedValue([]), detail: vi.fn() };
    mount(undefined, { service }); await waitFor(() => expect(service.list).toHaveBeenCalledOnce());
    expect(screen.getByText('Loading your horses…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' })); await screen.findByText('No horses registered to you');
    await act(async () => resolve(rows)); expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  });
});
