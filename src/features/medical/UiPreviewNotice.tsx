import { AlertBanner } from '../../design-system';
/** Opt-in author UI fixtures only. Production cannot enable this notice or a fixture transport. */
export function UiPreviewNotice() {
  return import.meta.env.DEV && import.meta.env.VITE_UI_PREVIEW === 'true' ? <AlertBanner type="simulated" title="Bản xem trước giao diện">Chỉ dữ liệu thử. Không ghi vào hệ thống hay cơ sở dữ liệu thật.</AlertBanner> : null;
}
