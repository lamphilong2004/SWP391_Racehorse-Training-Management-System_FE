import type { CurrentUser } from '../../shared/auth/authApi';
import type { CanonicalOwnerSnapshot } from './ownerModel';

// Test-only structural fixtures. Not a business seed, store, HTTP DTO or production adapter.
export const ownerA: CurrentUser = { id: 17, userCode: 'OWN-17', fullName: 'Owner Alpha', email: 'owner.alpha@example.test', accountStatus: 'ACTIVE', roles: ['HORSE_OWNER'] };
export const ownerB: CurrentUser = { ...ownerA, id: 18, userCode: 'OWN-18', fullName: 'Owner Beta', email: 'owner.beta@example.test' };
export function canonicalFixture(): CanonicalOwnerSnapshot {
  const horse = (id: number, ownerId: number, name: string) => ({ id, name, horseCode: `RH-${id}`, breed: 'Thoroughbred', sex: 'GELDING', foaledDate: '2021-03-12', countryOfOrigin: 'Ireland', lifecycle: 'ACTIVE', healthStatus: 'MONITORING', trainingAvailability: 'AVAILABLE', primaryPhotoUrl: null, currentOwnerships: [{ owner: { id: ownerId }, effectiveFrom: '2026-01-01', effectiveTo: null }], pedigree: { sire: { name: 'Northern Star' }, dam: { name: 'Silver Mist' } }, currentAssignment: { yard: 'North Yard', boxCode: 'A-12', effectiveFrom: '2026-01-01' } });
  const session = (id: number, horseId: number, status = 'COMPLETED') => ({ session: { id, sessionCode: `SES-${id}`, horse: { id: horseId }, status, scheduledStart: '2026-10-17T06:00:00Z', scheduledEnd: '2026-10-17T07:00:00Z', focus: 'Steady canter', phaseName: 'Foundation' }, actual: { totalDistanceM: 1200 } });
  return { horseRegistry: { records: [horse(7, ownerA.id, 'Thunder Bolt'), horse(8, ownerB.id, 'Ocean Pride')] }, programs: [{ horse: { id: 7 }, name: 'Endurance foundation', status: 'ACTIVE', periodStart: '2026-10-01', periodEnd: '2026-10-31', currentTrainer: { fullName: 'Trainer fixture' }, phases: [{ name: 'Foundation', startDate: '2026-10-01', endDate: '2026-10-31' }] }], sessions: [session(42, 7), session(43, 8), { ...session(44, 7, 'SCHEDULED'), session: { ...session(44, 7, 'SCHEDULED').session, scheduledStart: '2026-10-20T06:00:00Z', scheduledEnd: '2026-10-20T07:00:00Z' } }] };
}
