import { ApiError, type CurrentUser } from '../../../shared/auth/authApi';
import type { SampleData } from '../../../shared/data/sampleStore';
import type { HorseHistoryService, ReadinessChecklist } from './historyTypes';

/** Feature extension inside the existing canonical sample snapshot; never a second key/store. */
type Snapshot = SampleData & { horseReadinessEvents?: { horseId: number; actorId: number; occurredAt: string; action: 'HEAD_TRAINER_READINESS_REVIEWED' }[] };
export function createHorseHistorySample(source: { readSamples(): Snapshot; saveSamples(data: Snapshot): void; getBusinessActor(): CurrentUser | null }, now = () => new Date()): HorseHistoryService {
  const read = (id: number, roles: string[], signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const actor = source.getBusinessActor();
    if (!actor) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again to view horse history.');
    if (actor.accountStatus !== 'ACTIVE' || !actor.roles.some((role) => roles.includes(role))) throw new ApiError(403, 'FORBIDDEN', 'This horse action is unavailable for your role.');
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid horse.');
    const data = source.readSamples();
    if (source.getBusinessActor()?.id !== actor.id) throw new ApiError(401, 'UNAUTHORIZED', 'Your session changed. Sign in again.');
    if (!data.horseRegistry) throw new ApiError(503, 'BUSINESS_RULE_VIOLATION', 'Horse history is not available yet.');
    const staff = actor.roles.some((role) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM'].includes(role));
    if (!staff && !data.programs.some((p) => p.horse.id === id && p.currentTrainer?.id === actor.id)) throw new ApiError(403, 'FORBIDDEN', 'This horse is outside your assigned programs.');
    const horse = data.horseRegistry.records.find((item) => item.id === id);
    if (!horse) throw new ApiError(404, 'NOT_FOUND', 'Horse not found.');
    return { data, horse, actor };
  };
  return {
    source: 'sample',
    async timeline(id, page, signal) {
      read(id, ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'], signal);
      if (!Number.isSafeInteger(page) || page < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid page.');
      // CORE-004 leaves eventType/source mappings unresolved. Never manufacture event enums or clinical titles.
      return { items: [], page, size: 20, totalItems: 0, totalPages: 0 };
    },
    async ownerships(id, signal) { return read(id, ['CLUB_MANAGER', 'HEAD_TRAINER'], signal).horse.currentOwnerships.map((o) => ({ id: o.id, owner: { id: o.owner.id, fullName: o.owner.fullName, ...(o.owner.userCode === undefined ? {} : { userCode: o.owner.userCode }) }, sharePercentage: o.sharePercentage, effectiveFrom: o.effectiveFrom, effectiveTo: o.effectiveTo, isManagingOwner: o.isManagingOwner })); },
    async assignments(id, signal) { const { horse } = read(id, ['CLUB_MANAGER', 'HEAD_TRAINER'], signal); const a = horse.currentAssignment; return a ? [{ id: a.id, stableBoxId: a.stableBoxId, boxCode: a.boxCode, yard: a.yard, effectiveFrom: a.effectiveFrom, effectiveTo: a.effectiveTo, reason: null, assignedBy: { id: a.assignedBy.id, fullName: a.assignedBy.fullName } }] : []; },
    async checklist(id, signal) {
      const { data, horse } = read(id, ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN'], signal);
      const parents = horse.pedigree;
      const conditions = [
        ['IDENTITY', 'Horse identity', 'Horse identity is valid.', Boolean(horse.name.trim() && horse.horseCode.trim() && horse.name.length <= 150 && horse.horseCode.length <= 20)],
        ['PEDIGREE', 'Pedigree', 'Pedigree is valid.', Boolean((parents.sire.name || parents.sire.horseId) && (parents.dam.name || parents.dam.horseId))],
        ['OWNER', 'Owner', 'A valid owner is linked to the horse.', horse.currentOwnerships.length > 0],
        ['FREE_STABLE_BOX', 'Free stable box', 'A free stable box is assigned to the horse.', Boolean(horse.currentAssignment)],
        ['VETERINARIAN_BASELINE', 'Veterinarian baseline', 'A valid Veterinarian baseline is recorded.', data.horseRegistry!.baselineHorseIds.includes(id)],
      ] as const;
      return { horseId: id, horseCode: horse.horseCode, name: horse.name, lifecycle: horse.lifecycle, activatedAt: horse.activatedAt,
        checklist: [
          ...conditions.map(([key, label, description, satisfied]) => ({ id: key, label, description, requirement: 'MANDATORY' as const, state: satisfied ? 'SATISFIED' as const : 'PENDING' as const })),
          { id: 'HEAD_TRAINER_READINESS_REVIEW', label: 'Head Trainer readiness review', description: 'Recommended review; this item is non-blocking and does not gate activation.', requirement: 'RECOMMENDED', state: data.horseReadinessEvents?.some((e) => e.horseId === id) ? 'REVIEWED' : 'NOT_REVIEWED' },
        ],
      } satisfies ReadinessChecklist;
    },
    async acknowledge(id) {
      const { data, actor } = read(id, ['HEAD_TRAINER']);
      // Bodyless acknowledgement, repeated invocations create distinct events; never set lifecycle/health/availability.
      (data.horseReadinessEvents ??= []).push({ horseId: id, actorId: actor.id, occurredAt: now().toISOString(), action: 'HEAD_TRAINER_READINESS_REVIEWED' });
      source.saveSamples(data); // Resolve only after canonical persistence succeeds.
    },
  };
}
