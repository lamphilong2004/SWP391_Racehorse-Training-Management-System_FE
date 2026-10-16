import type { MedicalActor } from './models';
import type { MedicalRuntime } from './runtimeContext';
import { createMedicalService } from './service';
import { isRoleCode } from '../../shared/auth/roles';
export async function loadMedicalRuntime(accessToken?: string): Promise<MedicalRuntime> {
  if (!accessToken?.trim()) throw new Error('Sign in is not connected to this medical view.');
  let response: Response;
  try {
    response = await fetch((import.meta.env.VITE_API_BASE_URL ?? '') + '/api/auth/me', { credentials: 'omit', headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken } });
  } catch { throw new Error('Unable to reach account verification. Retry when the API is available.'); }
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to access medical care.' : 'Unable to verify your account.');
  const body = await response.json().catch(() => null) as { success?: boolean; data?: MedicalActor } | null;
  const actor = body?.data;
  if (body?.success !== true || !actor || !Number.isSafeInteger(actor.id) || !actor.fullName ||
    !Array.isArray(actor.roles) || actor.roles.length === 0 || !actor.roles.every(isRoleCode) ||
    actor.accountStatus !== 'ACTIVE') throw new Error('An active authenticated account is required.');
  return { actor, service: createMedicalService(import.meta.env.VITE_API_BASE_URL ?? '', accessToken) };
}
