import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mode = vi.hoisted(() => ({ ROLE_TEST_LOGIN: false }));
vi.mock('../../staging/stagingMode', () => mode);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); mode.ROLE_TEST_LOGIN = false; });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });

it.each([true, false])('keeps an API session intact through a role-test sign-in and sign-out (remember=%s)', async (remember) => {
  const api = (await import('./authSession')).authSession;
  api.save('api-fixture-token', 3600, remember);
  mode.ROLE_TEST_LOGIN = true;
  vi.resetModules();
  const test = (await import('./authSession')).authSession;
  expect(test.read()).toBeNull();
  test.save('role-test:TRAINER', 3600, remember);
  expect(test.read()?.accessToken).toBe('role-test:TRAINER');
  test.clear();
  mode.ROLE_TEST_LOGIN = false;
  vi.resetModules();
  expect((await import('./authSession')).authSession.read()?.accessToken).toBe('api-fixture-token');
});

it.each(['localStorage', 'sessionStorage'] as const)('rejects test and legacy markers in API %s without restoring them', async (kind) => {
  const key = kind === 'localStorage' ? 'racehorse.auth.local.v1' : 'racehorse.auth.session.v1';
  for (const token of ['role-test:GROOM', 'ui-demo-session:GROOM', 'staging-sample:GROOM']) {
    window[kind].setItem(key, JSON.stringify({ accessToken: token, expiresAt: Date.now() + 60000 }));
    vi.resetModules();
    expect((await import('./authSession')).authSession.read()).toBeNull();
    expect(window[kind].getItem(key)).toBeNull();
  }
});

it('rejects a non-test token inside the role-test namespace', async () => {
  mode.ROLE_TEST_LOGIN = true;
  localStorage.setItem('racehorse.role-test.local.v1', JSON.stringify({ accessToken: 'real-looking-token', expiresAt: Date.now() + 60000 }));
  expect((await import('./authSession')).authSession.read()).toBeNull();
});
