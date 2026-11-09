/** Equal to the backend's ck_incident__incident_type (V20261109_01): the 1_Scope!C15 types plus the DEC-013 in-ride types. */
export const INCIDENT_TYPE_CODES = [
  'OFF_FEED', 'COLIC_SIGNS', 'FEVER', 'HOOF_OR_LEG_PROBLEM', 'OTHER',
  'LAMENESS', 'INJURY', 'BREATHING_PROBLEM', 'BEHAVIOUR_PROBLEM', 'EXHAUSTION',
] as const;
export type IncidentType = typeof INCIDENT_TYPE_CODES[number];
export const isIncidentType = (value: unknown): value is IncidentType => (INCIDENT_TYPE_CODES as readonly unknown[]).includes(value);
