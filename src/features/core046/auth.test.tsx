import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';

beforeEach(() => { authSession.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function visit(path: string) {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return router;
}

describe('CORE-046 route guard', () => {
  it('fails closed without shared JWT integration', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const router = visit('/medical/my-tasks');
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks /api/auth/me and denies a non-Groom treatment route', async () => {
    authSession.save('jwt-from-host', 3600, false);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 1, userCode: 'VET-001', email: 'vet@example.test', fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toContain('/api/auth/me');
    expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer jwt-from-host');
    expect(authSession.read()?.accessToken).toBe('jwt-from-host');
  });
});
