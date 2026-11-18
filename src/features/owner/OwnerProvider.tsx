// CORE-056 — điểm truyền service cho toàn bộ cổng Owner.
// Context giống một nguồn dữ liệu dùng chung cho những component con, không phải database.
// App gọi OwnerProvider với service đã chọn; OwnerPage lấy lại bằng useContext.
// Nếu chưa có tích hợp, giá trị mặc định là ownerContractPending để báo chưa khả dụng.
// Tên import ownerSampleTransport không có nghĩa runtime tự fallback sang sample:
// ở đây chỉ lấy đối tượng pending; việc chọn sample phải được cấu hình riêng rõ ràng.
// Không lưu mật khẩu và không tự thêm contract API trong provider này.

import { createContext, type ReactNode } from 'react';
import type { OwnerService } from './ownerModel';
import { ownerContractPending } from './ownerSampleTransport';

// Explicit integration boundary; default never silently selects sample or invents a real API contract.
// eslint-disable-next-line react-refresh/only-export-components
export const OwnerContext = createContext<OwnerService>(ownerContractPending);
export function OwnerProvider({ service, children }: { service: OwnerService; children: ReactNode }) {
  return <OwnerContext.Provider value={service}>{children}</OwnerContext.Provider>;
}
