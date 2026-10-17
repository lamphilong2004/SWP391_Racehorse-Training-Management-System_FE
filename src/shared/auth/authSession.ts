import { DEMO_UI_ONLY } from '../../demo/demoMode';
import { STAGING_SAMPLE } from '../../staging/stagingMode';

// One canonical session API, with dev harness storage isolated from actual API authentication.
const LOCAL_SESSION_KEY = STAGING_SAMPLE ? 'racehorse.staging-auth.local.v1' : DEMO_UI_ONLY ? 'racehorse.dev-auth.local.v1' : 'racehorse.auth.local.v1';
const TAB_SESSION_KEY = STAGING_SAMPLE ? 'racehorse.staging-auth.session.v1' : DEMO_UI_ONLY ? 'racehorse.dev-auth.session.v1' : 'racehorse.auth.session.v1';

export interface StoredAuthSession {
  accessToken: string;
  expiresAt: number;
}

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window[kind];
  } catch {
    return undefined;
  }
}

function readFrom(kind: 'localStorage' | 'sessionStorage', key: string): StoredAuthSession | null {
  const target = storage(kind);
  if (!target) return null;
  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (typeof value.accessToken !== 'string' || !value.accessToken || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)
      || (!DEMO_UI_ONLY && value.accessToken.startsWith('ui-demo-session:'))
      || (!STAGING_SAMPLE && value.accessToken.startsWith('staging-sample:'))
      || (STAGING_SAMPLE && !value.accessToken.startsWith('staging-sample:'))) {
      target.removeItem(key);
      return null;
    }
    return { accessToken: value.accessToken, expiresAt: value.expiresAt };
  } catch {
    target.removeItem(key);
    return null;
  }
}

export const authSession = {
  read(): StoredAuthSession | null {
    return readFrom('localStorage', LOCAL_SESSION_KEY) ?? readFrom('sessionStorage', TAB_SESSION_KEY);
  },

  save(accessToken: string, expiresIn: number, remember: boolean): StoredAuthSession {
    const session = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
    this.clear();
    const target = storage(remember ? 'localStorage' : 'sessionStorage');
    const key = remember ? LOCAL_SESSION_KEY : TAB_SESSION_KEY;
    target?.setItem(key, JSON.stringify(session));
    return session;
  },

  clear(): void {
    storage('localStorage')?.removeItem(LOCAL_SESSION_KEY);
    storage('sessionStorage')?.removeItem(TAB_SESSION_KEY);
  },
};
