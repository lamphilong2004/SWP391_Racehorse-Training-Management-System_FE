import type { HorseDetail, Ownership, Page, StableAssignment } from '../api/types';

// CORE-004 flow1-horse.openapi.yaml @ f8e7895ba4ad4816f951c56d6480fd01178f1bc5.
// Một TimelineEvent mô tả sự kiện đã có từ service, không phải lệnh tạo sự kiện.
// targetType/targetId là tùy chọn: thiếu thì không được tự ghép link sang ca y tế
// hoặc buổi tập dựa trên title. Mapping nguồn phải theo contract thực tế.
export interface TimelineEvent { occurredAt: string; eventType: string; title: string; targetType?: string | null; targetId?: number | null }
// Union tách rõ điều kiện bắt buộc (SATISFIED/PENDING) với đánh giá HT chỉ
// khuyến nghị (REVIEWED/NOT_REVIEWED). Tên state khác nhau giúp người đọc tránh
// hiểu nhầm rằng nút HT xác nhận sẽ tự đổi lifecycle sang ACTIVE.
export type ChecklistItem = {
  id: 'IDENTITY' | 'PEDIGREE' | 'OWNER' | 'FREE_STABLE_BOX' | 'VETERINARIAN_BASELINE';
  label: string; description: string; requirement: 'MANDATORY'; state: 'SATISFIED' | 'PENDING';
} | { id: 'HEAD_TRAINER_READINESS_REVIEW'; label: string; description: string; requirement: 'RECOMMENDED'; state: 'REVIEWED' | 'NOT_REVIEWED' };
export interface ReadinessChecklist { horseId: number; horseCode: string; name: string; lifecycle: HorseDetail['lifecycle']; activatedAt?: string | null; checklist: ChecklistItem[] }
// Đây là ranh giới giữa các tab lịch sử và nguồn dữ liệu. timeline có phân trang;
// ownerships/assignments trả danh sách theo endpoint hiện hành. acknowledge
// không nhận tình trạng y tế hay quyết định kích hoạt thủ công từ UI.
export interface HorseHistoryService {
  readonly source: 'api' | 'sample';
  timeline(id: number, page: number, signal?: AbortSignal): Promise<Page<TimelineEvent>>;
  ownerships(id: number, signal?: AbortSignal): Promise<Ownership[]>;
  assignments(id: number, signal?: AbortSignal): Promise<StableAssignment[]>;
  checklist(id: number, signal?: AbortSignal): Promise<ReadinessChecklist>;
  acknowledge(id: number): Promise<void>;
}
