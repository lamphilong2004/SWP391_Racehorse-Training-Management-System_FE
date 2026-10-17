import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { requestApi, createAuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { getBusinessActor, setBusinessActor } from '../../shared/data/businessData';
import { resetSamples } from '../../shared/data/sampleStore';

const manager: CurrentUser = { id: 201, userCode: 'TEST-CM', fullName: 'Test Manager', email: 'manager@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); setBusinessActor(null); resetSamples(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setBusinessActor(null); });
function open(path: string, user = manager) {
  authSession.save('test-real-auth-token', 3600, false);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={{ login: vi.fn(), currentUser: async () => user, logout: async () => undefined }}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
it('registers, declares ownership, assigns a FREE box and shows pending baseline without manual activation', async () => {
  const router = open('/horses/new'), user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Register Horse' });
  await user.type(screen.getByLabelText('Horse name *'), 'River Dance');
  await user.type(screen.getByLabelText('Horse ID *'), 'RD-015');
  fireEvent.change(screen.getByLabelText('Date of birth *'), { target: { value: '2023-03-14' } });
  await user.selectOptions(screen.getByLabelText('Sex *'), 'Filly');
  await user.selectOptions(screen.getByLabelText('Breed *'), 'Thoroughbred');
  await user.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · River Dance' });
  const id = Number(router.state.location.pathname.split('/')[2]);
  await user.type(screen.getByLabelText('Sire *'), 'Northern Crest');
  await user.type(screen.getByLabelText('Dam *'), 'Silver Lining');
  await user.selectOptions(screen.getByLabelText('Owner *'), '17');
  await user.type(screen.getByLabelText('Ownership share (%)'), '65');
  await user.click(screen.getByRole('button', { name: 'Assign Stable Box' }));
  await user.click(await screen.findByRole('button', { name: /B-07/ }));
  await user.click(screen.getByRole('button', { name: /^Assign Box$/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Save & Continue' }));
  await screen.findByRole('heading', { name: 'Pending Activation' });
  expect(await screen.findByText(/River Dance becomes ACTIVE automatically/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Approve|Activate horse/ })).not.toBeInTheDocument();
  const saved = await requestApi<{ lifecycle: string; activatedAt: string | null; currentOwnerships: { sharePercentage: number }[] }>(`/api/horses/${id}`);
  expect(saved.lifecycle).toBe('DRAFT'); expect(saved.activatedAt).toBeNull(); expect(saved.currentOwnerships[0].sharePercentage).toBe(65);
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps registration input on duplicate code and can retry with corrected code', async () => {
  open('/horses/new'); const user = userEvent.setup(); await screen.findByRole('heading', { name: 'Register Horse' });
  await user.type(screen.getByLabelText('Horse name *'), 'Retry Horse'); await user.type(screen.getByLabelText('Horse ID *'), 'RH-007');
  fireEvent.change(screen.getByLabelText('Date of birth *'), { target: { value: '2021-03-01' } });
  await user.selectOptions(screen.getByLabelText('Sex *'), 'Mare'); await user.selectOptions(screen.getByLabelText('Breed *'), 'Arabian');
  await user.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  expect(await screen.findByText('Horse code or registration number is already used.')).toBeInTheDocument();
  expect(screen.getByLabelText('Horse name *')).toHaveValue('Retry Horse');
  await user.clear(screen.getByLabelText('Horse ID *')); await user.type(screen.getByLabelText('Horse ID *'), 'RETRY-008');
  await user.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  expect(await screen.findByRole('heading', { name: 'Pedigree & Ownership · Retry Horse' })).toBeInTheDocument();
});
it('lists and opens the existing horse profile and keeps Vet clinical fields read-only', async () => {
  open('/horses', { ...manager, roles: ['GROOM'] });
  await userEvent.click(await screen.findByRole('link', { name: /Thunder Bolt/ }));
  expect(await screen.findByRole('heading', { name: 'Thunder Bolt' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit identity' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Set health|Activate/ })).not.toBeInTheDocument();
});
it('denies non-Manager onboarding before mounting a form', async () => {
  open('/horses/new', { ...manager, roles: ['GROOM'] });
  expect(await screen.findByText('Access denied')).toBeInTheDocument();
  expect(screen.queryByLabelText('Horse name *')).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps real auth out of samples and clears the sample actor at logout', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600, user: manager } }), { status: 200 }));
  await createAuthApi({ fetcher }).login({ email: manager.email, password: 'test-input-only' });
  expect(fetcher).toHaveBeenCalledOnce();
  open('/dashboard'); await screen.findByRole('heading', { name: 'Club Manager Workspace' });
  expect(getBusinessActor()?.id).toBe(201);
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' }); expect(getBusinessActor()).toBeNull();
});
it('API mode never falls back to samples on 404, 403 or network failure', async () => {
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  for (const status of [403, 404]) {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: 'Real API error' } }), { status }));
    await expect(requestApi('/api/horses', {}, { fetcher })).rejects.toMatchObject({ status, message: 'Real API error' });
  }
  await expect(requestApi('/api/horses', {}, { fetcher: vi.fn().mockRejectedValue(new Error('offline')) })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
});
