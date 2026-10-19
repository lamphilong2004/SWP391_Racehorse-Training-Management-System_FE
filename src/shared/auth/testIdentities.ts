import type { CurrentUser } from './authApi';
import type { RoleCode } from './roles';

/**
 * Fictitious role identities (names follow the approved Figma examples) on the reserved `.test` domain.
 * They are NOT accounts: no password, no JWT, no server authority. Used only by the protected Preview role test login
 * and by test fixtures. Production builds never import this module.
 */
const PEOPLE: Record<RoleCode, { id: number; fullName: string; login: string }> = {
  CLUB_MANAGER: { id: 10, fullName: 'Hoang Minh Tuan', login: 'club.manager' },
  HEAD_TRAINER: { id: 11, fullName: 'Vo Thanh Son', login: 'head.trainer' },
  TRAINER: { id: 12, fullName: 'Nguyen Minh Khoa', login: 'trainer' },
  WORK_RIDER: { id: 13, fullName: 'Pham Quang Huy', login: 'work.rider' },
  VETERINARIAN: { id: 15, fullName: 'Dr. Nguyen Thu Ha', login: 'veterinarian' },
  GROOM: { id: 16, fullName: 'Bui Van Hai', login: 'groom' },
  HORSE_OWNER: { id: 17, fullName: 'Tran Quoc Bao', login: 'horse.owner' },
};

export function testIdentity(role: RoleCode): CurrentUser {
  const person = PEOPLE[role];
  return { id: person.id, userCode: `USR-${String(person.id).padStart(4, '0')}`, fullName: person.fullName, email: `${person.login}@racehorse.test`, roles: [role], accountStatus: 'ACTIVE' };
}
