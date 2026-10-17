import { createContext, useContext } from 'react';
import type { RoleCode } from '../../shared/auth/roles';
import type { Core046Client } from './client';

export interface Core046Session { client: Core046Client; user: { id: number; fullName: string; role: RoleCode } }
export const SessionContext = createContext<Core046Session | null>(null);
export function useCore046Session(): Core046Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('CORE-046 session is unavailable.');
  return value;
}
