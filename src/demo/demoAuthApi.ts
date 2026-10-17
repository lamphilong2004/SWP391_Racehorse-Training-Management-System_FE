import { ApiError, type AuthApi, type CurrentUser } from '../shared/auth/authApi';
import { ROLE_CODES, type RoleCode } from '../shared/auth/roles';
import { sampleUser } from '../shared/data/sampleStore';

/**
 * DEVELOPMENT HARNESS ONLY. Simulated identity for UI-first work without the backend.
 * - No network call and no JWT: the stored value is a plain marker `ui-demo-session:<ROLE>`, which is never sent to any
 *   server because harness mode routes every `/api/**` call to the local sample adapter.
 * - The 7 local presentation accounts are the sample users (`sampleUser`): one fictitious account per approved role.
 *   They are not SQL accounts. No password is stored anywhere: any non-empty password is accepted locally.
 */
const MARKER = 'ui-demo-session:';
const SESSION_SECONDS = 8 * 60 * 60;
const INVALID = () => new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password.');

export function demoEmail(role: RoleCode): string {
  return sampleUser(role).email;
}

function roleFromEmail(email: string): RoleCode | undefined {
  const normalized = email.trim().toLowerCase();
  return ROLE_CODES.find((role) => demoEmail(role) === normalized);
}

export const demoAuthApi: AuthApi = {
  async login({ email, password }) {
    const role = roleFromEmail(email);
    if (!role || !password) throw INVALID();
    return { accessToken: `${MARKER}${role}`, tokenType: 'Bearer', expiresIn: SESSION_SECONDS, user: sampleUser(role) };
  },
  async currentUser(token) {
    const role = token.startsWith(MARKER) ? (token.slice(MARKER.length) as RoleCode) : undefined;
    if (!role || !ROLE_CODES.includes(role)) throw new ApiError(401, 'UNAUTHORIZED', 'Your session expired. Sign in again to continue.');
    return sampleUser(role) as CurrentUser;
  },
  async logout() {
    /* Nothing to call: harness mode has no server session. */
  },
};
