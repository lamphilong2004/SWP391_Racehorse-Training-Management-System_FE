import type { ReactNode } from 'react';
import { AlertBanner, EmptyState, ErrorState, LoadingState } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { errorMessage } from './data';
export function RiderShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.roles.includes('WORK_RIDER')) return <AlertBanner type="danger" title="Không có quyền truy cập">Chỉ Work Rider được dùng không gian này.</AlertBanner>;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: 'WORK_RIDER' }} breadcrumb={[{ label: 'Lượt cưỡi của tôi', to: '/rider' }, { label: 'Work Rider' }]}>{children}</AppShell>;
}
export function ReadState({ error, loading, retry }: { error?: unknown; loading: boolean; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Không có quyền truy cập">Lượt cưỡi này nằm ngoài phạm vi được phép của bạn. Phiên đăng nhập vẫn còn hiệu lực.</AlertBanner>;
  if (error instanceof ApiError && error.status === 404) return <EmptyState title="Không tìm thấy lượt cưỡi" description="Lượt cưỡi được yêu cầu không có." />;
  if (error) return <ErrorState title="Không tải được dữ liệu lượt cưỡi" description={errorMessage(error)} onRetry={retry} />;
  return loading ? <LoadingState label="Đang tải lượt cưỡi…" /> : null;
}
