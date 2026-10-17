import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { authSession } from '../../shared/auth/authSession';
import { AuthProvider } from '../../shared/auth/AuthProvider';

afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });

function visit(path: string) { render(<AuthProvider><RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} /></AuthProvider>); }

describe('CORE-046 route guard', () => {
  it('redirects without a signed-in session', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks /api/auth/me and denies a non-Groom treatment route', async () => {
    authSession.save('jwt-from-host', 3600, false);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 1, userCode: 'V-1', email: 'vet@example.test', fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByRole('alert')).toHaveTextContent('Access Denied');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toContain('/api/auth/me');
  });
});
