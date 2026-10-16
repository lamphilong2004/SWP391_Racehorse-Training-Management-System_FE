import { createContext, useContext } from 'react';
import type { MedicalActor, MedicalService } from './models';
export interface MedicalRuntime { actor: MedicalActor; service: MedicalService }
export const RuntimeContext = createContext<MedicalRuntime | null>(null);
export function useMedicalRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('Medical runtime is missing');
  return value;
}
