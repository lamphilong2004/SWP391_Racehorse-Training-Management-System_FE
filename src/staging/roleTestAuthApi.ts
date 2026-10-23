import { ApiError, TEST_IDENTITY_PREFIX, type AuthApi } from '../shared/auth/authApi';
import { isRoleCode } from '../shared/auth/roles';
import { testIdentity } from '../shared/auth/testIdentities';

// Public, non-secret local marker. Never a JWT and never sent to the backend (see requestApi).
export const roleTestAuthApi: AuthApi = {
  async login({ email: selectedRole, password }) {
    if (!isRoleCode(selectedRole) || password !== '') throw new ApiError(401, 'UNAUTHORIZED', 'Chọn vai trò để xem. Không nhập thông tin đăng nhập ở đây.');
    return { accessToken: `${TEST_IDENTITY_PREFIX}${selectedRole}`, tokenType: 'Bearer', expiresIn: 3600, user: testIdentity(selectedRole) };
  },
  async currentUser(marker) {
    const role = marker.startsWith(TEST_IDENTITY_PREFIX) ? marker.slice(TEST_IDENTITY_PREFIX.length) : '';
    if (!isRoleCode(role)) throw new ApiError(401, 'UNAUTHORIZED', 'Hãy chọn lại vai trò.');
    return testIdentity(role);
  },
  async logout() { /* Browser-local test identity only. */ },
};
