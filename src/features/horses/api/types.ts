/**
 * DTOs of the Flow 1 contract (BE docs/api/flow1-horse.openapi.yaml, CORE-004) and the shared user summary
 * (docs/api/shared.openapi.yaml, CORE-003). Field names are the contract's — keep them in sync.
 */

export type HorseLifecycle = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type HealthStatus = 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED';
export type TrainingAvailability = 'AVAILABLE' | 'LIMITED' | 'LOCKED';
export type BoxStatus = 'FREE' | 'OCCUPIED';

export interface UserRef {
  id: number;
  userCode?: string;
  fullName: string;
}

export interface ParentRef {
  horseId: number | null;
  horseCode?: string | null;
  name: string | null;
}

export interface Pedigree {
  sire: ParentRef;
  dam: ParentRef;
}

export interface Ownership {
  id: number;
  owner: UserRef;
  sharePercentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isManagingOwner: boolean;
}

export interface StableAssignment {
  id: number;
  stableBoxId: number;
  boxCode: string;
  yard: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  assignedBy: UserRef;
}

export interface HorseIdentityRequest {
  horseCode: string;
  name: string;
  breed: string | null;
  sex: string | null;
  foaledDate: string | null;
  countryOfOrigin: string | null;
  registrationNo: string | null;
  /** Declared strength codes; omitted keeps the current declaration, [] clears it. */
  strengths?: string[];
}

export interface HorseDetail {
  id: number;
  horseCode: string;
  name: string;
  breed: string | null;
  sex: string | null;
  foaledDate: string | null;
  lifecycle: HorseLifecycle;
  healthStatus: HealthStatus | null;
  trainingAvailability: TrainingAvailability;
  currentBoxCode: string | null;
  primaryPhotoUrl: string | null;
  countryOfOrigin: string | null;
  registrationNo: string | null;
  activatedAt: string | null;
  /** Declared by Club Manager; not a Head Trainer confirmation. */
  strengths?: string[];
  pedigree: Pedigree;
  currentOwnerships: Ownership[];
  currentAssignment: StableAssignment | null;
  createdAt: string;
  updatedAt: string | null;
  /** CORE-004 non-clinical latestWeight projection, absent/null when no record exists. */
  latestWeight?: { weightKg: number; recordedAt: string } | null;
}

export interface PedigreeRequest {
  sire: ParentRef;
  dam: ParentRef;
}

export interface OwnershipRequest {
  ownerUserId: number;
  sharePercentage: number;
  effectiveFrom: string;
  isManagingOwner: boolean;
}

export interface StableBox {
  id: number;
  boxCode: string;
  yard: string | null;
  status: BoxStatus;
  currentHorse: { id: number; horseCode: string; name: string } | null;
}

export interface StableAssignmentRequest {
  stableBoxId: number;
  effectiveFrom: string;
  reason?: string | null;
}

export type ActivationItem = 'IDENTITY' | 'PEDIGREE' | 'OWNER' | 'FREE_STABLE_BOX' | 'VETERINARIAN_BASELINE';
export type ActivationChecklistItem = {
  id: ActivationItem; label: string; description: string;
  requirement: 'MANDATORY'; state: 'SATISFIED' | 'PENDING';
} | {
  id: 'HEAD_TRAINER_READINESS_REVIEW'; label: string; description: string;
  requirement: 'RECOMMENDED'; state: 'REVIEWED' | 'NOT_REVIEWED';
};

export interface ActivationStatus {
  horseId: number;
  horseCode: string;
  name: string;
  lifecycle: HorseLifecycle;
  activatedAt: string | null;
  checklist: ActivationChecklistItem[];
}

export interface Photo {
  id: number;
  url: string;
  uploadedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** shared.openapi.yaml UserSummary (owner picker reads GET /api/admin/users?role=HORSE_OWNER). */
export interface UserSummary {
  id: number;
  userCode: string;
  fullName: string;
  email: string;
  roles: string[];
  accountStatus: 'ACTIVE' | 'INACTIVE';
}
