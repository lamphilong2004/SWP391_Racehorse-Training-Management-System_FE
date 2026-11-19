import type { CurrentUser } from '../../shared/auth/authApi';
import type { StatusOf } from '../../design-system';
import type { EvaluationResult } from '../evaluation/models';

/** View projection of CORE-004 Owner schemas, pinned at f8e7895 (BE PR #9).
 * Presentation-only missing fields stay null; they are never added to the HTTP DTO.
 */
// OwnerHorse là dữ liệu phục vụ giao diện sau khi adapter đã chuyển đổi DTO.
// Tên born/code/health dùng cho component, không có nghĩa Backend nhận các tên
// đó khi ghi. Owner Portal là luồng xem: đừng dùng model này như form sửa bệnh án.
// Sức khỏe, vòng đời và khả năng tập vẫn là ba thuộc tính khác nhau.
export interface OwnerHorse {
  id: number; name: string; code: string; breed: string | null; sex: string | null; born: string | null; country: string | null;
  lifecycle: StatusOf<'lifecycle'> | null; health: StatusOf<'health'> | null; availability: StatusOf<'availability'> | null;
  photo: string | null; stable: string | null; stableSince: string | null;
  sire: string | null; dam: string | null;
  ownership?: { sharePercentage: number; effectiveFrom: string; isManagingOwner: boolean };
  healthSummary?: { reviewDate: string | null; recovery: 'NOT_RECOVERED' | 'IMPROVING' | 'RECOVERED' | null; examinedAt: string | null; weights: { weightKg: number; recordedAt: string }[] };
  /** undefined: the list projection could not load the training summary (shown as unknown, never as "no program"). */
  program?: { name: string; phase: string | null; from: string | null; to: string | null; trainer: string | null; completed?: number; planned?: number } | null;
  sessions: { id: number; date: string; title: string | null; distanceM: number | null; status: StatusOf<'session'>; evaluationResult?: EvaluationResult }[];
  nextSession: { date: string; end: string | null; title: string | null; phase: string | null } | null;
}
// actorId xác định người xem trong ngữ cảnh UI; signal giúp hủy lượt đọc đã lỗi
// thời. API xác thực bằng JWT, không tin actorId từ FE để cấp quyền sở hữu.
export interface OwnerContext { actorId: number; signal?: AbortSignal }
export interface OwnerService {
  readonly source?: 'sample' | 'api';
  list(context: OwnerContext): Promise<OwnerHorse[]>;
  detail(id: number, context: OwnerContext): Promise<OwnerHorse>;
}
/** Structural subset of canonical readSamples(); never a second store or an HTTP response schema. */
// Các kiểu CanonicalOwner* bên dưới chỉ mô tả nguồn fixture/test được tiêm vào.
// Chúng không phải DTO HTTP thứ hai và không cho phép runtime API lỗi tự chuyển
// sang sample. Đọc tên kiểu này không được suy ra Production đang có dữ liệu mẫu.
export interface CanonicalOwnerSnapshot {
  horseRegistry?: { records: {
    id: number; name: string; horseCode: string; breed?: string | null; sex?: string | null; foaledDate?: string | null;
    countryOfOrigin?: string | null; lifecycle: string; healthStatus?: string | null; trainingAvailability?: string | null;
    primaryPhotoUrl?: string | null;
    currentOwnerships: { owner: { id: number }; effectiveFrom: string; effectiveTo: string | null; sharePercentage?: number; isManagingOwner?: boolean }[];
    currentAssignment?: { yard?: string | null; boxCode: string; effectiveFrom: string } | null;
    pedigree?: { sire: { name?: string | null }; dam: { name?: string | null } };
  }[] };
  programs: { horse: { id: number }; name: string; status: string; periodStart?: string | null; periodEnd?: string | null; currentTrainer?: { fullName: string } | null; phases: { name: string; startDate: string; endDate: string }[] }[];
  sessions: { session: { id: number; sessionCode?: string; horse: { id: number }; status: string; scheduledStart: string; scheduledEnd?: string | null; focus?: string | null; phaseName?: string | null }; actual?: { totalDistanceM?: number | null } }[];
}
export interface CanonicalOwnerSource {
  readSamples(): CanonicalOwnerSnapshot;
  getBusinessActor(): CurrentUser | null;
}
