import type { CurrentUser } from '../../shared/auth/authApi';
import type { StatusOf } from '../../design-system';

/** View projection of CORE-004 Owner schemas, pinned at f8e7895 (BE PR #9).
 * Presentation-only missing fields stay null; they are never added to the HTTP DTO.
 */
export interface OwnerHorse {
  id: number; name: string; code: string; breed: string | null; sex: string | null; born: string | null; country: string | null;
  lifecycle: StatusOf<'lifecycle'> | null; health: StatusOf<'health'> | null; availability: StatusOf<'availability'> | null;
  photo: string | null; stable: string | null; stableSince: string | null;
  sire: string | null; dam: string | null;
  ownership?: { sharePercentage: number; effectiveFrom: string; isManagingOwner: boolean };
  healthSummary?: { reviewDate: string | null; recovery: 'NOT_RECOVERED' | 'IMPROVING' | 'RECOVERED' | null; examinedAt: string | null; weights: { weightKg: number; recordedAt: string }[] };
  /** undefined: the list projection could not load the training summary (shown as unknown, never as "no program"). */
  program?: { name: string; phase: string | null; from: string | null; to: string | null; trainer: string | null; completed?: number; planned?: number } | null;
  sessions: { id: number; date: string; title: string | null; distanceM: number | null; status: StatusOf<'session'> }[];
  nextSession: { date: string; end: string | null; title: string | null; phase: string | null } | null;
}
export interface OwnerContext { actorId: number; signal?: AbortSignal }
export interface OwnerService {
  readonly source?: 'sample' | 'api';
  list(context: OwnerContext): Promise<OwnerHorse[]>;
  detail(id: number, context: OwnerContext): Promise<OwnerHorse>;
}
/** Structural subset of canonical readSamples(); never a second store or an HTTP response schema. */
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
