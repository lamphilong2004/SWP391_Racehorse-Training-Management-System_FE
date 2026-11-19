import { createContext, useContext, type ReactNode } from 'react';
import { businessDataMode, getBusinessActor } from '../../../shared/data/businessData';
import { readSamples, saveSamples } from '../../../shared/data/sampleStore';
import { createHorseHistoryApi } from './historyApi';
import { createHorseHistorySample } from './historySample';
import type { HorseHistoryService } from './historyTypes';

// Provider cho phép tests truyền service riêng để kiểm tra UI độc lập Backend.
// Nguồn sample chỉ được tạo trong MODE=test; code ứng dụng bình thường mặc định
// dùng API. Lỗi 403/500 không làm hook đổi sang sample, nên unavailable vẫn là
// unavailable chứ không thành lịch sử giả.
const api = createHorseHistoryApi();
const sample = import.meta.env.MODE === 'test'
  ? createHorseHistorySample({ readSamples, saveSamples, getBusinessActor })
  : null;
// Context chỉ giữ adapter của cây React hiện tại, không phải kho lưu bệnh án hay
// phiên đăng nhập mới. Nếu host truyền service thì dùng service đó; quyền HTTP
// vẫn nằm ở shared auth client/Backend, không được suy ra chỉ từ Provider.
const Context = createContext<HorseHistoryService | null>(null);
/** Central feature adapter boundary, injectable for fixtures; no shared router/transport edits. */
export function HorseHistoryProvider({ service, children }: { service: HorseHistoryService; children: ReactNode }) { return <Context.Provider value={service}>{children}</Context.Provider>; }
// eslint-disable-next-line react-refresh/only-export-components
export function useHorseHistoryService() { return useContext(Context) ?? (import.meta.env.MODE === 'test' && businessDataMode() === 'sample' && sample ? sample : api); }
