import type { CurrentUser } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import type { FlowRequest } from '../main-flows/api';

export interface Page<T> { items: T[]; page: number; size: number; totalItems: number; totalPages: number }
export interface UserDetail extends CurrentUser {
  lastLoginAt: string | null; experienceYears: number | null; experienceLevel: string | null;
  skills: Skill[];
}
export type SkillKind = 'TRAINER_SPECIALIZATION' | 'RIDER_SKILL';
export interface Skill { id: number; name: string; kind: SkillKind }
export interface UserInput { fullName: string; email: string; roleCode: RoleCode; experienceYears: number | null; experienceLevel: string | null; skillIds: number[] }
export interface RoleInfo { roleCode: RoleCode; displayName: string; scoping: string }
export function accountApi(request: FlowRequest) {
  const write = <T,>(path: string, method: string, value: unknown) => request<T>(path, { method, body: JSON.stringify(value) });
  return {
    list: (query: URLSearchParams, signal: AbortSignal) => request<Page<UserDetail>>(`/api/admin/users?${query}`, { signal }),
    detail: (id: number, signal: AbortSignal) => request<UserDetail>(`/api/admin/users/${id}`, { signal }),
    roles: (signal: AbortSignal) => request<RoleInfo[]>('/api/admin/roles', { signal }),
    skills: (kind: SkillKind, signal: AbortSignal) => request<Skill[]>(`/api/admin/skills?kind=${kind}`, { signal }),
    create: (input: UserInput) => write<UserDetail>('/api/admin/users', 'POST', input),
    update: (id: number, input: UserInput) => write<UserDetail>(`/api/admin/users/${id}`, 'PUT', input),
    status: (id: number, accountStatus: 'ACTIVE' | 'INACTIVE') => write<UserDetail>(`/api/admin/users/${id}/status`, 'PATCH', { accountStatus }),
  };
}
