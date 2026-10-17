import { ApiError, type AuthApi, type CurrentUser } from '../shared/auth/authApi';
import { ROLE_CODES, type RoleCode } from '../shared/auth/roles';
import { sampleUser } from '../shared/data/sampleStore';

/**
 * UI DEMO ONLY. Simulated identity for presenting screens without the backend.
 * - No network call and no JWT: the stored value is a plain marker `ui-demo-session:<ROLE>`, which is never sent to any
 *   server because demo mode routes every `/api/**` call to the local sample store.
 * - Identities are the existing sample users (`sampleUser`), not SQL accounts.
 */
const MARKER = 'ui-demo-session:';
const SESSION_SECONDS = 8 * 60 * 60;

export function demoEmail(role: RoleCode): string {
  return sampleUser(role).email;
}

function roleFromEmail(email: string): RoleCode | undefined {
  const normalized = email.trim().toLowerCase();
  return ROLE_CODES.find((role) => demoEmail(role) === normalized);
}

export const demoAuthApi: AuthApi = {
  async login({ email }) {
    const role = roleFromEmail(email);
    if (!role) throw new ApiError(401, 'UNAUTHORIZED', 'UI demo: choose a role from the demo bar.');
    return { accessToken: `${MARKER}${role}`, tokenType: 'Bearer', expiresIn: SESSION_SECONDS, user: sampleUser(role) };
  },
  async currentUser(token) {
    const role = token.startsWith(MARKER) ? (token.slice(MARKER.length) as RoleCode) : undefined;
    if (!role || !ROLE_CODES.includes(role)) throw new ApiError(401, 'UNAUTHORIZED', 'UI demo session not recognised.');
    return sampleUser(role) as CurrentUser;
  },
  async logout() {
    /* Nothing to call: demo mode has no server session. */
  },
};
