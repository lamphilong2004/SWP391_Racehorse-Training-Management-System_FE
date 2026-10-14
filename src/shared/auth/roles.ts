/**
 * The 7 RBAC roles — `RoleCode` in BE docs/api/shared.openapi.yaml (CORE-003, DEC-004).
 * There is no SYSTEM role and no Farrier role. Frontend role checks are for usability only; the backend enforces RBAC.
 */
export const ROLE_CODES = [
  'CLUB_MANAGER',
  'HEAD_TRAINER',
  'TRAINER',
  'WORK_RIDER',
  'VETERINARIAN',
  'GROOM',
  'HORSE_OWNER',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

/** Display names as drawn in Figma (Sidebar 74:110, Header 74:367). */
export const ROLE_LABELS: Record<RoleCode, string> = {
  CLUB_MANAGER: 'Club Manager',
  HEAD_TRAINER: 'Head Trainer',
  TRAINER: 'Trainer',
  WORK_RIDER: 'Work Rider',
  VETERINARIAN: 'Veterinarian',
  GROOM: 'Groom / Stable Hand',
  HORSE_OWNER: 'Horse Owner',
};

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
