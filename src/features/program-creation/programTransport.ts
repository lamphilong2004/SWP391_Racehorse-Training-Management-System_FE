import { useMemo } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { createProgramCreationApi } from './programApi';

function authenticatedApi(handleApiError: (error: unknown) => boolean) {
  return createProgramCreationApi(async <T>(path: string, init?: RequestInit) => {
    try {
      const session = authSession.read();
      if (!session || session.expiresAt <= Date.now()) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Your session expired. Sign in again to continue.');
      }
      return await requestApi<T>(path, init, { token: session.accessToken });
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  });
}

/** Uses the same token, error handling and API base as login; no feature token store or mock mode. */
export function useProgramCreationApi() {
  const { handleApiError } = useAuth();
  return useMemo(() => authenticatedApi(handleApiError), [handleApiError]);
}
