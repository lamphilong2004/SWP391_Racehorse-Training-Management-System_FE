import { ApiError } from '../../shared/auth/authApi';
import { STATUS_REGISTRY } from '../../design-system';
import type { CanonicalOwnerSnapshot, CanonicalOwnerSource, OwnerContext, OwnerHorse, OwnerService } from './ownerModel';

const unavailable = () => new ApiError(503, 'BUSINESS_RULE_VIOLATION', 'Owner information is not available yet. Please contact the club.');
const text = (value: string | null | undefined) => value?.trim() || null;
const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? value : null;
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function status<T extends Record<string, unknown>>(registry: T, value: string | null | undefined): keyof T | null {
  return value && Object.hasOwn(registry, value) ? value as keyof T : null;
}

/**
 * Read-only sample transport extension. Bind ONLY to canonical readSamples/getBusinessActor.
 * No storage, HTTP endpoint, sample seed, user-id override, clinical projection or fallback.
 * CORE-004 grants only an open ownership row. Future starts remain fail-closed
 * pending CORE-055 confirmation of effective-period SQL semantics.
 */
export function createOwnerSampleTransport(source: CanonicalOwnerSource, now: () => Date = () => new Date()): OwnerService {
  const actor = (context: OwnerContext) => {
    if (context.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const user = source.getBusinessActor();
    if (!user || user.id !== context.actorId) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again to view your horses.');
    if (user.accountStatus !== 'ACTIVE') throw new ApiError(403, 'FORBIDDEN', 'Your account is deactivated.');
    if (!user.roles.includes('HORSE_OWNER')) throw new ApiError(403, 'FORBIDDEN', 'This portal is available to Horse Owners only.');
    return user;
  };
  const read = (context: OwnerContext) => {
    const user = actor(context);
    const snapshot = source.readSamples();
    actor(context);
    if (!snapshot.horseRegistry) throw unavailable();
    const today = now().toISOString().slice(0, 10);
    const owned = snapshot.horseRegistry.records.filter((horse) => horse.currentOwnerships.some((relation) => {
      if (relation.owner.id !== user.id) return false;
      if (!day(relation.effectiveFrom)) throw unavailable();
      if (relation.effectiveFrom > today) return false;
      if (relation.effectiveTo === null) return true;
      if (!day(relation.effectiveTo)) throw unavailable();
      return false;
    }));
    return { snapshot, owned, today };
  };
  const project = (horse: NonNullable<CanonicalOwnerSnapshot['horseRegistry']>['records'][number], snapshot: CanonicalOwnerSnapshot, today: string): OwnerHorse => {
    const program = snapshot.programs.find((item) => item.horse.id === horse.id && item.status === 'ACTIVE');
    const phase = program?.phases.find((item) => item.startDate <= today && item.endDate >= today);
    const sessions = snapshot.sessions.filter((item) => item.session.horse.id === horse.id);
    return {
      id: horse.id, name: horse.name, code: horse.horseCode, breed: text(horse.breed), sex: text(horse.sex), born: date(horse.foaledDate), country: text(horse.countryOfOrigin),
      lifecycle: status(STATUS_REGISTRY.lifecycle, horse.lifecycle), health: status(STATUS_REGISTRY.health, horse.healthStatus), availability: status(STATUS_REGISTRY.availability, horse.trainingAvailability),
      // These fields are absent from the Owner contract; never borrow wider staff projections.
      photo: null, stable: null, stableSince: null,
      sire: text(horse.pedigree?.sire.name), dam: text(horse.pedigree?.dam.name),
      healthSummary: { reviewDate: null, recovery: null, examinedAt: null, weights: [] },
      program: program ? { name: program.name, phase: text(phase?.name), from: date(program.periodStart), to: date(program.periodEnd), trainer: null } : null,
      // Do not expose evaluation, rider feedback, sensor telemetry, medical notes, medication or raw entities.
      sessions: sessions.filter((item) => ['COMPLETED', 'INTERRUPTED'].includes(item.session.status) && date(item.session.scheduledStart)).sort((a, b) => Date.parse(b.session.scheduledStart) - Date.parse(a.session.scheduledStart)).slice(0, 10).map((item) => ({
        id: item.session.id, date: item.session.scheduledStart, title: text(item.session.sessionCode), distanceM: null,
        status: item.session.status as 'COMPLETED' | 'INTERRUPTED',
      })),
      nextSession: null,
    };
  };
  return {
    source: 'sample',
    async list(context) { const { snapshot, owned, today } = read(context); return owned.map((horse) => project(horse, snapshot, today)); },
    async detail(id, context) {
      actor(context);
      if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid horse.');
      const { snapshot, owned, today } = read(context);
      const horse = owned.find((item) => item.id === id);
      if (!horse) throw new ApiError(snapshot.horseRegistry!.records.some((item) => item.id === id) ? 403 : 404, snapshot.horseRegistry!.records.some((item) => item.id === id) ? 'FORBIDDEN' : 'NOT_FOUND', 'This horse is not available in your portal.');
      const result = project(horse, snapshot, today);
      const ownership = horse.currentOwnerships.find((item) => item.owner.id === context.actorId && item.effectiveTo === null && item.effectiveFrom <= today);
      if (ownership && typeof ownership.sharePercentage === 'number' && Number.isFinite(ownership.sharePercentage) && typeof ownership.isManagingOwner === 'boolean') {
        result.ownership = { sharePercentage: ownership.sharePercentage, effectiveFrom: ownership.effectiveFrom, isManagingOwner: ownership.isManagingOwner };
      }
      return result;
    },
  };
}

/** Safe unconfigured boundary. Integration Owner explicitly selects sample or the pinned HTTP adapter. */
export const ownerContractPending: OwnerService = { async list() { throw unavailable(); }, async detail() { throw unavailable(); } };
