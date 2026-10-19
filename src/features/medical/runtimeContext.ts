import { createContext, useContext } from 'react';
import type { MedicalService } from './models';
import type { CurrentUser } from '../../shared/auth/authApi';
export interface MedicalRuntime { actor: CurrentUser; service: MedicalService }
export const RuntimeContext = createContext<MedicalRuntime | null>(null);
export function useMedicalRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('Medical runtime is missing');
  return value;
}
