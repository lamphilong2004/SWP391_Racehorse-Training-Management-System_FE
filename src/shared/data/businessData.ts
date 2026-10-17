import type { CurrentUser } from '../auth/authApi';
import { DEMO_UI_ONLY } from '../../demo/demoMode';

/** Backend auth remains authoritative. Only explicitly configured missing business APIs use samples. */
export const businessDataMode = () => DEMO_UI_ONLY || import.meta.env.VITE_BUSINESS_DATA_SOURCE === 'sample' ? 'sample' : 'api';
let actor: CurrentUser | null = null;
export function setBusinessActor(value: CurrentUser | null) { actor = value; }
export function getBusinessActor() { return actor; }
export function usesSampleData(path: string): boolean {
  if (businessDataMode() !== 'sample') return false;
  const route = path.split('?')[0];
  // UI DEMO ONLY: the simulated identity must never reach a backend, so every API call stays in the sample store.
  if (DEMO_UI_ONLY) return route.startsWith('/api/');
  // Existing auth, health and restriction APIs always use the real backend, even in mixed mode.
  if (/^\/api\/horses\/(?:\d+\/(?:training-availability|availability|medical-restrictions)|availability\/batch)$/.test(route)) return false;
  return /^\/api\/(horses(?:\/|$)|stable-boxes(?:\/|$)|program-templates(?:\/|$)|training-programs(?:\/|$)|training-sessions(?:\/|$)|groom(?:\/|$)|work-rider(?:\/|$)|incidents(?:\/|$)|medical\/(cases|herd-health)(?:\/|$))/.test(route)
    || route === '/api/admin/users';
}
