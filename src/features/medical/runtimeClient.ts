import type { MedicalActor } from './models';
import type { MedicalRuntime } from './runtimeContext';
import { createMedicalService } from './service';
export async function loadMedicalRuntime(accessToken?: string): Promise<MedicalRuntime> {
  const response = await fetch((import.meta.env.VITE_API_BASE_URL ?? '') + '/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json', ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) } });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to access medical care.' : 'Unable to verify your account.');
  const body = await response.json() as { success?: boolean; data?: MedicalActor };
  const actor = body.data;
  if (body.success !== true || !actor || !Number.isSafeInteger(actor.id) || !actor.fullName ||
    !Array.isArray(actor.roles) || actor.accountStatus !== 'ACTIVE') throw new Error('An active authenticated account is required.');
  const mock = import.meta.env.DEV && import.meta.env.VITE_MEDICAL_MOCK === 'true';
  return { actor, service: createMedicalService(actor, mock) };
}
