import { demoAuthApi, demoEmail } from './demoAuthApi';
import { DEMO_UI_ONLY } from './demoMode';
import { ROLE_CODES } from '../shared/auth/roles';

it('is off unless explicitly enabled (tests run without the harness mode)', () => {
  expect(DEMO_UI_ONLY).toBe(false);
});

it('simulates each of the 7 roles locally with a non-JWT marker and no network call', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  for (const role of ROLE_CODES) {
    const response = await demoAuthApi.login({ email: demoEmail(role), password: 'ignored' });
    expect(response.user.roles).toEqual([role]);
    expect(response.accessToken).toBe(`ui-demo-session:${role}`);
    expect(response.accessToken.split('.')).toHaveLength(1);
    await expect(demoAuthApi.currentUser(response.accessToken, () => undefined)).resolves.toMatchObject({ roles: [role], accountStatus: 'ACTIVE' });
  }
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

it('rejects unknown identities and markers with 401', async () => {
  await expect(demoAuthApi.login({ email: 'someone@example.com', password: 'x' })).rejects.toMatchObject({ status: 401 });
  await expect(demoAuthApi.currentUser('eyJhbGciOi.fake.jwt', () => undefined)).rejects.toMatchObject({ status: 401 });
  await expect(demoAuthApi.currentUser('ui-demo-session:SYSTEM', () => undefined)).rejects.toMatchObject({ status: 401 });
});
