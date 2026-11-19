import { useMemo } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { createProgramCreationApi } from './programApi';

function authenticatedApi(handleApiError: (error: unknown) => boolean) {
  return createProgramCreationApi(async <T>(path: string, init?: RequestInit) => {
    try {
      // Đọc phiên ngay trước mỗi request; API được memo hóa không giữ token cũ sau khi phiên thay đổi.
      const session = authSession.read();
      if (!session || session.expiresAt <= Date.now()) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
      }
      return await requestApi<T>(path, init, { token: session.accessToken });
    } catch (error) {
      // AuthProvider xử lý phiên chung, còn lỗi vẫn phải tới màn hình để kết thúc trạng thái chờ và báo lỗi form.
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
