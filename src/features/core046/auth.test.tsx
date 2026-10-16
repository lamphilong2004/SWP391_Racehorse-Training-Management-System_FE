import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { configureCore046AccessTokenProvider } from './session';

afterEach(() => { configureCore046AccessTokenProvider(null); vi.unstubAllGlobals(); });

function visit(path: string) { render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />); }

describe('CORE-046 route guard', () => {
  it('fails closed without shared JWT integration', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in is required');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks /api/auth/me and denies a non-Groom treatment route', async () => {
    configureCore046AccessTokenProvider(() => 'jwt-from-host');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 1, fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toContain('/api/auth/me');
  });
});
