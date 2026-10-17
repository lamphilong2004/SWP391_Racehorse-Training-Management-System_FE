import { authSession } from '../shared/auth/authSession';
import { requestApi } from '../shared/auth/authApi';
import { setBusinessActor } from '../shared/data/businessData';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setBusinessActor(null); });

it('API auth rejects a copied staging marker and leaves its separate namespace untouched', () => {
  const marker = JSON.stringify({ accessToken: 'staging-sample:CLUB_MANAGER', expiresAt: Date.now() + 60000 });
  localStorage.setItem('racehorse.staging-auth.local.v1', marker);
  localStorage.setItem('racehorse.auth.local.v1', marker);
  expect(authSession.read()).toBeNull();
  expect(localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
  expect(localStorage.getItem('racehorse.staging-auth.local.v1')).toBe(marker);
});
it('API client blocks sample/dev markers before fetch', async () => {
  for (const token of ['staging-sample:TRAINER', 'ui-demo-session:GROOM']) await expect(requestApi('/api/horses', {}, { token })).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
});
it('API mode never changes to samples when real transport fails', async () => {
  localStorage.setItem('racehorse.business-samples.v1', '{}');
  vi.mocked(fetch).mockRejectedValue(new Error('offline'));
  await expect(requestApi('/api/dashboard/club-manager', {}, { token: 'real-fixture-token' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(fetch).toHaveBeenCalledOnce();
});
