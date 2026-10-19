import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { authSession } from '../shared/auth/authSession';
import type { CurrentUser } from '../shared/auth/authApi';
import type { RoleCode } from '../shared/auth/roles';
import type { SessionResultView } from '../features/evaluation/models';
import { fixtureResponse, headTrainer, ok } from '../features/program-creation/__tests__/httpFixtures';
import { buildRoutes } from './router';

// Integration-worktree regressions only; no product runtime imports these fixtures.
const result: SessionResultView = {
  session: { id: 42, sessionCode: 'SES-42', horse: { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt' },
    programId: 1001, phaseName: 'Foundation', scheduledStart: '2026-11-01T06:00:00Z', status: 'COMPLETED',
    workRider: { id: 13, fullName: 'Fixture Rider' }, trainer: { id: 11, fullName: 'Fixture Trainer' }, exercises: [] },
  actual: { simulated: false }, alerts: [],
};
const paths = {
  program: '/training/programs/new', evaluation: '/training/sessions/42/evaluation', medical: '/medical',
};
function mount(role: RoleCode, path: string, signedIn = true) {
  const user: CurrentUser = { ...headTrainer, roles: [role] };
  if (signedIn) authSession.save('integration-fixture-jwt', 3600, false);
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/auth/me') return ok(user);
    if (url.pathname === '/api/auth/login') return ok({ accessToken: 'integration-fixture-jwt', tokenType: 'Bearer', expiresIn: 3600, user });
    if (url.pathname === '/api/training-sessions/42/result') return ok(result);
    if (url.pathname === '/api/medical/cases') return ok({ page: 0, size: 20, totalElements: 1,
      items: [{ id: 9, horseId: 7, reason: 'Fixture lameness', status: 'OPEN', openedAt: '2026-11-01T06:00:00Z', incidentIds: [], examinations: [], injuries: [], reexaminations: [] }] });
    return fixtureResponse(url, init, user);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return { router, fetcher };
}

const allowed = [
  ['HEAD_TRAINER', paths.program, 'Create Training Program', '/api/horses'],
  ['TRAINER', paths.evaluation, 'Session Evaluation · SES-42', '/api/training-sessions/42/result'],
  ['VETERINARIAN', paths.medical, 'Medical Cases', '/api/medical/cases'],
] as const;

describe('dev + CORE-022 + CORE-033 + clean CORE-036 / production routes', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { cleanup(); authSession.clear(); vi.unstubAllGlobals(); });

  it.each(allowed)('restores %s into %s with the shared API base/session', async (role, path, heading, endpoint) => {
    const { router, fetcher } = mount(role, path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    if (role === 'HEAD_TRAINER') await screen.findByRole('radio', { name: 'Select Thunder Bolt' });
    if (role === 'VETERINARIAN') await screen.findByText('Fixture lameness');
    if (role === 'TRAINER') {
      fireEvent.click(screen.getByRole('tab', { name: 'Evaluation & Recommendation' }));
      expect(screen.getByRole('button', { name: 'Save Evaluation' })).toBeInTheDocument();
    }
    expect(router.state.location.pathname).toBe(path);
    expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname === endpoint)).toBe(true);
    for (const [input, init] of fetcher.mock.calls) {
      expect(new URL(String(input)).origin).toBe('http://localhost:8080');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer integration-fixture-jwt');
    }
    expect(authSession.read()?.accessToken).toBe('integration-fixture-jwt');
  });

  it.each(allowed)('returns %s to the requested %s after login', async (role, path, heading) => {
    const { router, fetcher } = mount(role, path, false);
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'fixture@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-fixture-only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/api/auth/login'))).toHaveLength(1);
    expect(authSession.read()?.accessToken).toBe('integration-fixture-jwt');
    expect(sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
    expect(localStorage.getItem('racehorse.auth.local.v1')).toContain('integration-fixture-jwt');
  });

  it.each([
    ['TRAINER', paths.program], ['VETERINARIAN', paths.program], ['HORSE_OWNER', paths.program],
    ['HEAD_TRAINER', paths.medical], ['TRAINER', paths.medical], ['GROOM', paths.medical],
    ['GROOM', paths.evaluation], ['HORSE_OWNER', paths.evaluation],
  ] as const)('blocks %s at %s before any feature request', async (role, path) => {
    const { fetcher } = mount(role, path);
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual(['/api/auth/me']);
    expect(authSession.read()?.accessToken).toBe('integration-fixture-jwt');
  });
});
