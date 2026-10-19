import type { CurrentUser } from '../auth/authApi';

/**
 * TEST-ONLY switch for the sample business adapter (regression fixtures). Every runtime build is API-only:
 * `import.meta.env.MODE` is inlined at build time, so the sample transport is never reachable or bundled outside Vitest.
 * Never falls back to samples after a real API error.
 */
const testSampleMode = () => import.meta.env.MODE === 'test' && import.meta.env.VITE_BUSINESS_DATA_SOURCE === 'sample';
export const businessDataMode = (): 'sample' | 'api' => (testSampleMode() ? 'sample' : 'api');
let actor: CurrentUser | null = null;
export function setBusinessActor(value: CurrentUser | null) { actor = value; }
export function getBusinessActor() { return actor; }
export function usesSampleData(path: string): boolean {
  if (!testSampleMode()) return false;
  const route = path.split('?')[0];
  // Cross-role fixtures without any backend: every API call stays in the sample store.
  if (import.meta.env.VITE_SAMPLE_SCOPE === 'all') return route.startsWith('/api/');
  // Mixed fixtures: auth, health and restriction APIs remain on the (mocked) backend.
  if (/^\/api\/horses\/(?:\d+\/(?:training-availability|availability|medical-restrictions)|availability\/batch)$/.test(route)) return false;
  return /^\/api\/(horses(?:\/|$)|stable-boxes(?:\/|$)|program-templates(?:\/|$)|training-programs(?:\/|$)|training-sessions(?:\/|$)|groom(?:\/|$)|work-rider(?:\/|$)|incidents(?:\/|$)|medical\/(cases|herd-health)(?:\/|$))/.test(route)
    || route === '/api/admin/users' || route === '/api/dashboard/club-manager' || route === '/api/admin/audit-log' || /^\/api\/exercises(?:\/|$)/.test(route);
}
