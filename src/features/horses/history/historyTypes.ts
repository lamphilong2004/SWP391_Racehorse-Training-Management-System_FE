import type { HorseDetail, Ownership, Page, StableAssignment } from '../api/types';

// CORE-004 flow1-horse.openapi.yaml @ f8e7895ba4ad4816f951c56d6480fd01178f1bc5.
export interface TimelineEvent { occurredAt: string; eventType: string; title: string; targetType?: string | null; targetId?: number | null }
export type ChecklistItem = {
  id: 'IDENTITY' | 'PEDIGREE' | 'OWNER' | 'FREE_STABLE_BOX' | 'VETERINARIAN_BASELINE';
  label: string; description: string; requirement: 'MANDATORY'; state: 'SATISFIED' | 'PENDING';
} | { id: 'HEAD_TRAINER_READINESS_REVIEW'; label: string; description: string; requirement: 'RECOMMENDED'; state: 'REVIEWED' | 'NOT_REVIEWED' };
export interface ReadinessChecklist { horseId: number; horseCode: string; name: string; lifecycle: HorseDetail['lifecycle']; activatedAt?: string | null; checklist: ChecklistItem[] }
export interface HorseHistoryService {
  readonly source: 'api' | 'sample';
  timeline(id: number, page: number, signal?: AbortSignal): Promise<Page<TimelineEvent>>;
  ownerships(id: number, signal?: AbortSignal): Promise<Ownership[]>;
  assignments(id: number, signal?: AbortSignal): Promise<StableAssignment[]>;
  checklist(id: number, signal?: AbortSignal): Promise<ReadinessChecklist>;
  acknowledge(id: number): Promise<void>;
}
