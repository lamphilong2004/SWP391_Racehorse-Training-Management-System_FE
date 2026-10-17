/** CORE-006, docs/api/flow3-medical.openapi.yaml. Reporter-safe fields only. */
export type IncidentType = 'OFF_FEED' | 'COLIC_SIGNS' | 'FEVER' | 'HOOF_OR_LEG_PROBLEM' | 'OTHER';
export type ObservedSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatus = 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED';

export interface IncidentCreateRequest {
  horseId: number;
  incidentType: IncidentType;
  observedSeverity: ObservedSeverity;
  observedAt: string;
  description?: string;
  preSessionCheckId?: number;
  trainingSessionId?: number;
  careTaskId?: number;
}

export interface Incident extends IncidentCreateRequest {
  id: number;
  incidentCode: string;
  reportedByUserId: number;
  reportedAt: string;
  status: IncidentStatus;
  medicalCaseId?: number;
}

export interface GroomTreatmentTask {
  id: number;
  horseId: number;
  assignedGroomUserId: number;
  instruction: string;
  taskDate: string;
  scheduledSlot?: string;
  status: 'PENDING' | 'COMPLETED';
  completedAt?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
}

export const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'OFF_FEED', label: 'Off feed' },
  { value: 'COLIC_SIGNS', label: 'Colic signs' },
  { value: 'FEVER', label: 'Fever' },
  { value: 'HOOF_OR_LEG_PROBLEM', label: 'Hoof or leg problem' },
  { value: 'OTHER', label: 'Other' },
];
