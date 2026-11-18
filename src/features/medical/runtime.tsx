// ĐỌC TỪ ĐÂY — CORE-036: cửa vào các màn bác sĩ thú y (Vet).
// File này không vẽ form khám và không lưu hồ sơ; nó chuẩn bị quyền + công cụ gọi Backend.
// AuthProvider cho biết ai đang đăng nhập; actor là tài khoản đó, roles là các vai trò của họ.
// accessToken/JWT là bằng chứng đăng nhập gửi lên API, không phải mật khẩu và không được ghi ra log.
// MedicalAccess kiểm tra tài khoản hoạt động và có VETERINARIAN trước khi dựng các trang con.
// MedicalProvider giống một điểm cấp phát: trang con lấy cùng actor/service qua useMedicalRuntime.
// Outlet là chỗ React Router đặt màn con đang mở, ví dụ danh sách ca hoặc chi tiết ca.
// Cách lần theo: runtime.tsx → pages.tsx → service.ts → Backend MedicalController/MedicalService.
// Chặn giao diện giúp tránh thao tác nhầm; Backend vẫn phải tự kiểm tra quyền cho từng request.

import { UiPreviewNotice } from './UiPreviewNotice';
import { useMemo, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { AlertBanner } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { createMedicalService } from './service';

import { RuntimeContext, type MedicalRuntime } from './runtimeContext';

export function MedicalProvider({ value, children }: { value: MedicalRuntime; children: ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
/** Role gate executes before mounting feature pages or making medical requests. */
export function MedicalAccess({ children }: { children?: ReactNode }) {
  const auth = useAuth();
  const actor = auth.user;
  const token = authSession.read()?.accessToken;
  // useMemo tái sử dụng service khi tài khoản/token chưa thay đổi, tránh tạo lại ở mỗi lần vẽ.
  // onApiError trỏ về xử lý phiên đăng nhập chung, ví dụ khi API trả lỗi hết hạn phiên.
  const runtime = useMemo(() => actor && token ? { actor, service: createMedicalService(token, auth.handleApiError) } : null,
    [actor, token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('VETERINARIAN'))
    return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  if (!runtime) return <AlertBanner type="danger" title="Đăng nhập lại để truy cập phần y tế" />;
  // key gồm tài khoản và hạn phiên: đổi người/phiên sẽ dựng lại cây màn y tế.
  // Nhờ đó state riêng của cây cũ không được tái sử dụng cho một tài khoản khác.
  return <MedicalProvider key={`${actor.id}:${auth.expiresAt}`} value={runtime}>
    <MedicalShell actor={actor}>{children}</MedicalShell>
  </MedicalProvider>;
}

function MedicalShell({ actor, children }: { actor: MedicalRuntime['actor']; children?: ReactNode }) {
  return <AppShell user={{ fullName: actor.fullName, role: 'VETERINARIAN' }} breadcrumb={[{ label: 'Y tế' }]}>
    <div className="medical-stack">
      <UiPreviewNotice />
      {children ?? <Outlet />}
    </div>
  </AppShell>;
}
