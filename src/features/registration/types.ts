import type { RoleCode } from '../../shared/auth/roles';

export const REGISTRATION_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];
export const STATUS_LABELS: Record<RegistrationStatus, string> = { PENDING_APPROVAL: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected' };
export const NEUTRAL_CONFIRMATION = 'If the details can be accepted, your request is waiting for Club Manager approval.';
export interface RegisterRequest { fullName: string; email: string; password: string; confirmPassword: string }
export interface RegistrationRequest {
  id: number; fullName: string; email: string; status: RegistrationStatus; requestedAt: string;
  reviewedAt?: string | null; reviewedBy?: { id: number; fullName: string; userCode?: string | null } | null;
  approvedRoleCode?: RoleCode | null; createdUserId?: number | null; decisionReason?: string | null;
}
export interface RegistrationQuery { status?: RegistrationStatus; page: number; size: number }
export interface RegistrationPage { items: RegistrationRequest[]; page: number; size: number; totalItems: number; totalPages: number }
export interface RequestContext { token: string; signal?: AbortSignal }
export interface RegistrationService {
  register(input: RegisterRequest): Promise<void>;
  list(query: RegistrationQuery, context: RequestContext): Promise<RegistrationPage>;
  approve(id: number, roleCode: RoleCode, context: RequestContext): Promise<RegistrationRequest>;
  reject(id: number, reason: string, context: RequestContext): Promise<RegistrationRequest>;
}
