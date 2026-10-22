import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { requestApi, createAuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { getBusinessActor, setBusinessActor } from '../../shared/data/businessData';
import { readSamples, resetSamples, saveSamples } from '../../shared/data/sampleStore';
import type { HorseDetail } from './api/types';

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
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2023-03-14' } });
  await user.selectOptions(screen.getByLabelText('Sex'), 'Filly');
  await user.selectOptions(screen.getByLabelText('Breed'), 'Thoroughbred');
  await user.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · River Dance' });
  const id = Number(router.state.location.pathname.split('/')[2]);
  await user.type(screen.getByLabelText('Sire *'), 'Northern Crest');
  await user.type(screen.getByLabelText('Dam *'), 'Silver Lining');
  await user.selectOptions(screen.getByLabelText('Owner'), '17');
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
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2021-03-01' } });
  await user.selectOptions(screen.getByLabelText('Sex'), 'Mare'); await user.selectOptions(screen.getByLabelText('Breed'), 'Arabian');
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
  open('/dashboard'); await screen.findByRole('heading', { name: 'Club Manager Dashboard' });
  expect(getBusinessActor()?.id).toBe(201);
  await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  await screen.findByRole('heading', { name: 'My Account' });
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
it.each([404, 503])('keeps a created identity reachable when supporting APIs return %s (transport fixtures only)', async (supportStatus) => {
  setBusinessActor(manager);
  const base = await requestApi<HorseDetail>('/api/horses/7');
  const created = { ...base, id: 501, horseCode: 'TRANSPORT-501', name: 'Transport Draft', lifecycle: 'DRAFT' as const };
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    let data: unknown;
    let status = 200;
    if (path === '/api/horses' && init?.method === 'POST') { data = created; status = 201; }
    else if (path === '/api/horses/501') data = created;
    else if (path === '/api/horses') data = { items: [created], page: 0, size: 20, totalItems: 1, totalPages: 1 };
    else return Promise.resolve(new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Supporting API unavailable' } }), { status: supportStatus }));
    return Promise.resolve(new Response(JSON.stringify({ success: true, data }), { status }));
  });
  vi.stubGlobal('fetch', fetcher);
  const router = open('/horses/new');
  await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: created.name } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: created.horseCode } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByText('Horse setup unavailable');
  expect(screen.queryByText('This horse was not found.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Horse setup unavailable');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: /^Back to Horses$/ }));
  await screen.findByRole('heading', { name: 'Horses' });
  fireEvent.click(screen.getByRole('link', { name: /Transport Draft/ }));
  await screen.findByRole('heading', { name: created.name });
  expect(router.state.location.pathname).toBe('/horses/501');
});
it('retains the identity 404 error without offering an unverified saved profile', async () => {
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Horse not found' } }), { status: 404 })));
  open('/horses/501/edit');
  await screen.findByText('This horse was not found.');
  expect(screen.queryByRole('link', { name: 'View saved horse profile' })).not.toBeInTheDocument();
});
it.each(['owners', 'assignments', 'activation'] as const)('keeps the form visible without inventing missing %s data (HTTP fixtures)', async (missing) => {
  setBusinessActor(manager);
  const horse = await requestApi<HorseDetail>('/api/horses/7');
  const activation = await requestApi('/api/horses/7/activation-status');
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const resource = path === '/api/admin/users' ? 'owners' : path.endsWith('/stable-assignments') ? 'assignments' : path.endsWith('/activation-status') ? 'activation' : 'horse';
    const data = resource === 'horse' ? horse : resource === 'owners' ? { items: [], page: 0, size: 100, totalItems: 0, totalPages: 0 } : resource === 'assignments' ? [] : activation;
    return Promise.resolve(new Response(JSON.stringify(resource === missing ? { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } } : { success: true, data }), { status: resource === missing ? 403 : 200 }));
  });
  vi.stubGlobal('fetch', fetcher);
  open('/horses/7/edit');
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · Thunder Bolt' });
  expect(screen.getByLabelText('Sire *')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeDisabled();
  expect(screen.getByLabelText('Owner')).toHaveProperty('disabled', missing === 'owners');
  if (missing === 'assignments') {
    expect(screen.getByText('Box history unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/Box history: none/)).not.toBeInTheDocument();
  }
  if (missing === 'activation') {
    expect(screen.getByText('Baseline status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Not yet recorded (Veterinarian)')).not.toBeInTheDocument();
  }
  fireEvent.submit(screen.getByRole('button', { name: 'Save & Continue' }).closest('form')!);
  expect(fetcher.mock.calls).toHaveLength(4);
});
it('retains typed and deliberately cleared fields across setup retry, then sends only contracted payloads (HTTP fixtures)', async () => {
  setBusinessActor(manager);
  const base = await requestApi<HorseDetail>('/api/horses/7');
  const horse = { ...base, currentOwnerships: [] };
  const activation = await requestApi('/api/horses/7/activation-status');
  let available = false;
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const failed = path.endsWith('/activation-status') && !available;
    const data = path === '/api/admin/users' ? { items: [{ id: 17, fullName: 'Test Owner', userCode: 'OWNER-17', email: 'owner@example.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' }], page: 0, size: 100, totalItems: 1, totalPages: 1 }
      : path.endsWith('/activation-status') ? activation : path.endsWith('/stable-assignments') ? [] : path.endsWith('/pending-activation') || path === '/api/horses' ? { items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 } : horse;
    return Promise.resolve(new Response(JSON.stringify(failed ? { success: false, error: { code: 'NOT_FOUND', message: 'Not implemented' } } : { success: true, data }), { status: failed ? 404 : init?.method === 'POST' ? 201 : 200 }));
  });
  vi.stubGlobal('fetch', fetcher);
  open('/horses/7/edit');
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · Thunder Bolt' });
  fireEvent.change(screen.getByLabelText('Sire *'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Dam *'), { target: { value: 'Edited Dam' } });
  fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '17' } });
  fireEvent.change(screen.getByLabelText('Ownership share (%)'), { target: { value: '65' } });
  available = true;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeEnabled());
  expect(screen.getByLabelText('Sire *')).toHaveValue('');
  expect(screen.getByLabelText('Dam *')).toHaveValue('Edited Dam');
  expect(screen.getByLabelText('Owner')).toHaveValue('17');
  expect(screen.getByLabelText('Ownership share (%)')).toHaveValue(65);
  fireEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));
  expect(await screen.findByText('Enter the sire.')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT' || init?.method === 'POST')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Sire *'), { target: { value: 'Edited Sire' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));
  await screen.findByRole('heading', { name: 'Pending Activation' });
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT' || init?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ sire: { horseId: null, name: 'Edited Sire' }, dam: { horseId: null, name: 'Edited Dam' } });
  expect(JSON.parse(String(writes[1][1]?.body))).toMatchObject({ ownerUserId: 17, sharePercentage: 65, isManagingOwner: false });
});
it('preserves existing parent references and ownership when saving unchanged pedigree', async () => {
  setBusinessActor(manager); await requestApi('/api/horses/7');
  const data = readSamples(); data.horseRegistry!.records[0].pedigree.sire = { horseId: 91, name: 'Northern Star', horseCode: 'SIRE-91' }; saveSamples(data);
  open('/horses/7/edit'); await screen.findByRole('heading', { name: 'Pedigree & Ownership · Thunder Bolt' });
  await userEvent.click(screen.getByRole('button', { name: 'Save & Continue' }));
  await screen.findByRole('heading', { name: 'Pending Activation' });
  const horse = readSamples().horseRegistry!.records[0];
  expect(horse.pedigree.sire).toEqual({ horseId: 91, name: null });
  expect(horse.currentOwnerships).toHaveLength(1); expect(horse.currentOwnerships[0].sharePercentage).toBe(100);
});
it('preserves a server-supplied sex value outside the Figma suggestions while editing identity', async () => {
  open('/horses/7/identity'); await screen.findByDisplayValue('Thunder Bolt');
  expect(screen.getByRole('combobox', { name: 'Sex' })).toHaveValue('GELDING');
  expect(screen.getByRole('option', { name: 'Gelding (as recorded)' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Sex value')).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Horse name *')); await userEvent.type(screen.getByLabelText('Horse name *'), 'Thunder Bolt Updated');
  await userEvent.click(screen.getByRole('button', { name: 'Save identity' }));
  await screen.findByRole('heading', { name: 'Thunder Bolt Updated' });
  expect(readSamples().horseRegistry!.records[0].sex).toBe('GELDING');
});
it('saves a minimal draft without inventing missing identity values', async () => {
  open('/horses/new'); await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'Draft Arrival' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'DRAFT-009' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · Draft Arrival' });
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'DRAFT-009')).toMatchObject({ lifecycle: 'DRAFT', breed: null, sex: null, foaledDate: null, activatedAt: null });
});
it('retains the actual custom breed rather than serializing the Other option', async () => {
  open('/horses/new'); await screen.findByRole('heading', { name: 'Register Horse' });
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'Custom Breed' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'CUSTOM-01' } });
  await userEvent.selectOptions(screen.getByLabelText('Breed'), '__CUSTOM__');
  fireEvent.change(screen.getByLabelText('Breed value'), { target: { value: 'Akhal-Teke' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  await screen.findByRole('heading', { name: 'Pedigree & Ownership · Custom Breed' });
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'CUSTOM-01')?.breed).toBe('Akhal-Teke');
});
it('makes pending horses after the first page reachable', async () => {
  setBusinessActor(manager); await requestApi('/api/horses/7');
  const data = readSamples(), base = data.horseRegistry!.records[0];
  for (let index = 0; index < 51; index++) data.horseRegistry!.records.push({ ...structuredClone(base), id: 3000 + index, name: `Pending Horse ${index}`, horseCode: `P-${index}`, lifecycle: 'DRAFT', activatedAt: null });
  saveSamples(data); open('/horses/pending-activation');
  await screen.findByRole('heading', { name: 'Pending Horse 0 · P-0' });
  expect(screen.getByText(/· 51 horses/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(await screen.findByRole('heading', { name: 'Pending Horse 50 · P-50' })).toBeInTheDocument();
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
});
it.each(['GROOM', 'WORK_RIDER'] as const)('provides shared header account logout for %s without a role chooser', async (role) => {
  open(role === 'GROOM' ? '/groom/today' : '/rider', { ...manager, roles: [role] });
  await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening), Test Manager$/ });
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  await screen.findByRole('heading', { name: 'My Account' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull(); expect(getBusinessActor()).toBeNull();
});
