import { ApiError, TEST_IDENTITY_PREFIX, type AuthApi } from '../shared/auth/authApi';
import { isRoleCode } from '../shared/auth/roles';
import { testIdentity } from '../shared/auth/testIdentities';

// Public, non-secret local marker. Never a JWT and never sent to the backend (see requestApi).
export const roleTestAuthApi: AuthApi = {
  async login({ email: selectedRole, password }) {
    if (!isRoleCode(selectedRole) || password !== '') throw new ApiError(401, 'UNAUTHORIZED', 'Choose a role to inspect. Do not enter credentials here.');
    return { accessToken: `${TEST_IDENTITY_PREFIX}${selectedRole}`, tokenType: 'Bearer', expiresIn: 3600, user: testIdentity(selectedRole) };
  },
  async currentUser(marker) {
    const role = marker.startsWith(TEST_IDENTITY_PREFIX) ? marker.slice(TEST_IDENTITY_PREFIX.length) : '';
    if (!isRoleCode(role)) throw new ApiError(401, 'UNAUTHORIZED', 'Choose a role again.');
    return testIdentity(role);
  },
  async logout() { /* Browser-local test identity only. */ },
};
