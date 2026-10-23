import type { ReactNode } from 'react';
import { AlertBanner, EmptyState, ErrorState, LoadingState } from '../../../design-system';
import { AppShell } from '../../../layout/AppShell';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import type { RoleCode } from '../../../shared/auth/roles';
import { supportingError } from './supportingHooks';
export function SupportingShell({ title, roles, children }: { title: string; roles: readonly RoleCode[]; children: ReactNode }) {
  const { user } = useAuth(); const role = user?.roles.find((candidate) => roles.includes(candidate));
  if (!user || !role) return <AlertBanner type="danger" title="Không có quyền truy cập">Vai trò của bạn không dùng được trang huấn luyện này.</AlertBanner>;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Huấn luyện' }, { label: title }]}>{children}</AppShell>;
}
export function SupportingReadState({ loading, error, retry }: { loading: boolean; error?: unknown; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Không có quyền truy cập">Máy chủ từ chối truy cập dữ liệu này. Phiên đăng nhập vẫn còn hiệu lực.</AlertBanner>;
  if (error instanceof ApiError && error.status === 404) return <EmptyState title="Không tìm thấy dữ liệu" description="Không có dữ liệu huấn luyện được yêu cầu." />;
  if (error) return <ErrorState title="Không tải được dữ liệu huấn luyện" description={supportingError(error)} onRetry={retry} />;
  return loading ? <LoadingState label="Đang tải dữ liệu huấn luyện…" /> : null;
}
