import { ApiError, type AuthApi } from '../shared/auth/authApi';
import { isRoleCode } from '../shared/auth/roles';
import { sampleUser } from '../shared/data/sampleStore';

// Public, non-secret local identity marker. Never a JWT or a backend credential.
const PREFIX = 'staging-sample:';
export const stagingAuthApi: AuthApi = {
  async login({ email: selectedRole, password }) {
    if (!isRoleCode(selectedRole) || password !== '') throw new ApiError(401, 'UNAUTHORIZED', 'Choose a sample workspace. Do not enter credentials here.');
    return { accessToken: `${PREFIX}${selectedRole}`, tokenType: 'Bearer', expiresIn: 3600, user: sampleUser(selectedRole) };
  },
  async currentUser(marker) {
    const role = marker.startsWith(PREFIX) ? marker.slice(PREFIX.length) : '';
    if (!isRoleCode(role)) throw new ApiError(401, 'UNAUTHORIZED', 'Choose a sample workspace again.');
    return sampleUser(role);
  },
  async logout() { /* Browser-local sample identity only. */ },
};
