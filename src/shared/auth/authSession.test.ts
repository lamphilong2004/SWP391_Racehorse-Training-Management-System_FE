import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mode = vi.hoisted(() => ({ DEMO_UI_ONLY: false }));
vi.mock('../../demo/demoMode', () => mode);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); mode.DEMO_UI_ONLY = false; });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });

it.each([true, false])('keeps API session intact through a dev login and logout (remember=%s)', async (remember) => {
  const api = (await import('./authSession')).authSession;
  api.save('api-fixture-token', 3600, remember);
  mode.DEMO_UI_ONLY = true;
  vi.resetModules();
  const dev = (await import('./authSession')).authSession;
  expect(dev.read()).toBeNull();
  dev.save('ui-demo-session:TRAINER', 3600, remember);
  expect(dev.read()?.accessToken).toBe('ui-demo-session:TRAINER');
  dev.clear();
  mode.DEMO_UI_ONLY = false;
  vi.resetModules();
  const restored = (await import('./authSession')).authSession;
  expect(restored.read()?.accessToken).toBe('api-fixture-token');
});

it.each(['localStorage', 'sessionStorage'] as const)('rejects old dev markers in API %s without restoring them', async (kind) => {
  const key = kind === 'localStorage' ? 'racehorse.auth.local.v1' : 'racehorse.auth.session.v1';
  window[kind].setItem(key, JSON.stringify({ accessToken: 'ui-demo-session:GROOM', expiresAt: Date.now() + 60000 }));
  const session = (await import('./authSession')).authSession;
  expect(session.read()).toBeNull();
  expect(window[kind].getItem(key)).toBeNull();
});

it('API logout does not remove the separate development session', async () => {
  mode.DEMO_UI_ONLY = true;
  const dev = (await import('./authSession')).authSession;
  dev.save('ui-demo-session:TRAINER', 3600, true);
  mode.DEMO_UI_ONLY = false;
  vi.resetModules();
  const api = (await import('./authSession')).authSession;
  api.save('api-fixture-token', 3600, true);
  api.clear();
  expect(localStorage.getItem('racehorse.dev-auth.local.v1')).not.toBeNull();
});
