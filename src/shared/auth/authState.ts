import { createContext, useContext } from 'react';
import type { RoleCode } from './roles';

export interface AuthUser {
  id: number;
  userCode: string;
  fullName: string;
  email: string;
  roles: RoleCode[];
  accountStatus: string;
}

export interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}

export function primaryRole(user: AuthUser): RoleCode {
  return user.roles[0];
}
