import { AlertBanner } from '../../design-system';
/** Opt-in author UI fixtures only. Production cannot enable this notice or a fixture transport. */
export function UiPreviewNotice() {
  return import.meta.env.DEV && import.meta.env.VITE_UI_PREVIEW === 'true' ? <AlertBanner type="simulated" title="UI fixture preview">Author test data only. No real Backend or Database writes.</AlertBanner> : null;
}
