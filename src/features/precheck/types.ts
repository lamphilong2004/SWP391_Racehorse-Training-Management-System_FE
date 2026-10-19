export const CHECK_ITEMS = [
  { key: 'GENERAL_CONDITION', label: 'General condition', hint: 'Alert, normal posture, no signs of distress' },
  { key: 'APPETITE_BEHAVIOUR', label: 'Appetite & behaviour', hint: 'Ate the morning feed; behaving as usual' },
  { key: 'LEGS_HOOVES', label: 'Legs & hooves', hint: 'No heat, no visible swelling, shoes secure' },
  { key: 'MOVEMENT', label: 'Movement when led out', hint: 'Sound when walked out — no visible lameness' },
  { key: 'TEMPERATURE', label: 'Temperature (if needed)', hint: 'Take only if something seems off; record if not needed' },
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
