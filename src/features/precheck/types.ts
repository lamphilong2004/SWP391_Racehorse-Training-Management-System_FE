export const CHECK_ITEMS = [
  { key: 'GENERAL_CONDITION', label: 'Thể trạng chung', hint: 'Tỉnh táo, tư thế bình thường, không có dấu hiệu khó chịu' },
  { key: 'APPETITE_BEHAVIOUR', label: 'Ăn uống & hành vi', hint: 'Đã ăn bữa sáng; hành vi như thường ngày' },
  { key: 'LEGS_HOOVES', label: 'Chân & móng', hint: 'Không nóng, không sưng, móng sắt chắc chắn' },
  { key: 'MOVEMENT', label: 'Dáng đi khi dắt ra', hint: 'Đi bình thường — không có dấu hiệu khập khiễng' },
  { key: 'TEMPERATURE', label: 'Nhiệt độ (nếu cần)', hint: 'Chỉ đo khi thấy bất thường; ghi chú nếu không cần đo' },
] as const;
export type CheckKey = typeof CHECK_ITEMS[number]['key'];
export type CheckItem = { result: 'NORMAL' | 'ABNORMAL'; observation?: string };
export type Checklist = Record<CheckKey, CheckItem>;
export interface PreSessionCheck {
  id: number; sessionId: number; checks: Checklist; overallResult: 'ALL_NORMAL' | 'ABNORMAL';
  performedBy: { id: number; fullName: string }; performedAt: string;
}
export interface PrecheckSession {
  id: number; sessionCode: string; horse: { id: number; name: string; horseCode: string };
  programId: number; phaseName: string; scheduledStart: string; scheduledEnd?: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';
  workRider: { id: number; fullName: string }; trainer?: { id: number; fullName: string } | null;
  preCheckResult?: 'ALL_NORMAL' | 'ABNORMAL' | null; blocked: boolean; blockedReasons: string[];
  blockedMessage?: string | null; trainingAvailability?: 'AVAILABLE' | 'LIMITED' | 'LOCKED';
  preSessionCheck?: PreSessionCheck | null; focus?: string | null;
}
