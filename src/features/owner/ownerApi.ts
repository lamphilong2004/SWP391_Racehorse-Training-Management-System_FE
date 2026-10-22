import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { STATUS_REGISTRY } from '../../design-system';
import type { OwnerContext, OwnerHorse, OwnerService } from './ownerModel';

// CORE-004 docs/api/flow1-horse.openapi.yaml @ f8e7895ba4ad4816f951c56d6480fd01178f1bc5.
// Only whitelisted Owner fields cross this boundary; no all-horses request or sample fallback.
const invalid = () => new ApiError(502, 'INVALID_RESPONSE', 'The Owner response does not match the contract.');
type Row = Record<string, unknown>;
const row = (value: unknown): Row => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row; };
const string = (value: unknown) => { if (typeof value !== 'string') throw invalid(); return value; };
const optionalString = (value: unknown) => value == null ? null : string(value);
const number = (value: unknown) => { if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(); return value; };
const integer = (value: unknown, minimum = 0) => { const result = number(value); if (!Number.isSafeInteger(result) || result < minimum) throw invalid(); return result; };
const boolean = (value: unknown) => { if (typeof value !== 'boolean') throw invalid(); return value; };
function date(value: unknown, timestamp = false): string {
  const result = string(value);
  if (!Number.isFinite(Date.parse(result)) || (timestamp ? !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) : !/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(result).toISOString().slice(0, 10) !== result)) throw invalid();
  return result;
}
const optionalDate = (value: unknown, timestamp = false) => value == null ? null : date(value, timestamp);
function enumeration<const T extends string>(value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw invalid(); return value as T;
}
function array(value: unknown, maximum = Infinity): unknown[] { if (!Array.isArray(value) || value.length > maximum) throw invalid(); return value; }
function card(value: unknown): OwnerHorse {
  const data = row(value);
  return {
    id: integer(data.id, 1), name: string(data.name), code: string(data.horseCode), breed: optionalString(data.breed), sex: optionalString(data.sex), born: optionalDate(data.foaledDate), country: null,
    lifecycle: enumeration(data.lifecycle, Object.keys(STATUS_REGISTRY.lifecycle) as NonNullable<OwnerHorse['lifecycle']>[]),
    health: data.healthStatus == null ? null : enumeration(data.healthStatus, Object.keys(STATUS_REGISTRY.health) as NonNullable<OwnerHorse['health']>[]),
    availability: enumeration(data.trainingAvailability, ['AVAILABLE', 'LIMITED', 'LOCKED']),
    photo: null, stable: null, stableSince: null, sire: null, dam: null, program: null, sessions: [], nextSession: null,
  };
}
function programOf(training: Row): OwnerHorse['program'] {
  if (training.currentProgram == null) return null;
  const program = row(training.currentProgram);
  enumeration(program.status, ['ACTIVE', 'PAUSED', 'COMPLETED']);
  return { name: string(program.name), phase: optionalString(program.currentPhaseName), from: date(program.periodStart), to: date(program.periodEnd), trainer: null,
    ...(program.sessionsCompleted === undefined ? {} : { completed: integer(program.sessionsCompleted) }),
    ...(program.sessionsPlanned === undefined ? {} : { planned: integer(program.sessionsPlanned) }),
  };
}
function detail(profileValue: unknown, healthValue: unknown, trainingValue: unknown, id: number): OwnerHorse {
  const profile = row(profileValue), health = row(healthValue), training = row(trainingValue);
  const horse = card(profile.horse);
  if (horse.id !== id) throw invalid();
  const pedigree = row(profile.pedigree), ownership = row(profile.myOwnership);
  horse.country = optionalString(profile.countryOfOrigin);
  horse.stable = optionalString(profile.currentBoxCode);
  horse.stableSince = optionalDate(profile.stableEffectiveFrom);
  horse.sire = optionalString(row(pedigree.sire).name); horse.dam = optionalString(row(pedigree.dam).name);
  horse.ownership = { sharePercentage: number(ownership.sharePercentage), effectiveFrom: date(ownership.effectiveFrom), isManagingOwner: boolean(ownership.isManagingOwner) };
  if (!Object.hasOwn(health, 'healthStatus')) throw invalid();
  horse.health = health.healthStatus === null ? null : enumeration(health.healthStatus, Object.keys(STATUS_REGISTRY.health) as NonNullable<OwnerHorse['health']>[]);
  horse.availability = enumeration(health.trainingAvailability, ['AVAILABLE', 'LIMITED', 'LOCKED']);
  horse.healthSummary = {
    reviewDate: optionalDate(health.restrictionReviewDate), examinedAt: optionalDate(health.lastExaminedAt, true),
    recovery: health.recoveryStatus == null ? null : enumeration(health.recoveryStatus, ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED']),
    weights: array(health.weights, 12).map((value) => { const item = row(value), weightKg = number(item.weightKg); if (weightKg <= 0 || weightKg > 9999.99 || Math.abs(weightKg * 100 - Math.round(weightKg * 100)) > 0.00001) throw invalid(); return { weightKg, recordedAt: date(item.recordedAt, true) }; }),
  };
  // Preserve the contract's newest-first weight order; do not infer missing records.
  horse.program = programOf(training);
  horse.sessions = array(training.recentSessions, 10).map((value, index) => {
    const item = row(value);
    // Evaluation labels are contract-allowed but their business vocabulary is not yet approved by Dung.
    return { id: index, date: date(item.scheduledStart, true), title: string(item.sessionCode), distanceM: null,
      status: enumeration(item.status, ['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED']) };
  });
  return horse;
}

export function createOwnerApi(options: { fetcher?: typeof fetch; baseUrl?: string; getToken?: () => string | undefined } = {}): OwnerService {
  const read = async (path: string, context: OwnerContext) => {
    context.signal?.throwIfAborted();
    const token = options.getToken ? options.getToken() : authSession.read()?.accessToken;
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again to view your horses.');
    const result = await requestApi<unknown>(path, { method: 'GET', signal: context.signal }, { ...options, token });
    context.signal?.throwIfAborted();
    return result;
  };
  return {
    source: 'api',
    async list(context) {
      const horses = array(await read('/api/owner/horses', context)).map(card);
      // The card projection has no program; read each owned horse's training summary so the card
      // never claims "no program" for a horse that has one. A failed read leaves it unknown.
      await Promise.all(horses.map(async (horse) => {
        try { horse.program = programOf(row(await read(`/api/owner/horses/${horse.id}/training-summary`, context))); }
        catch (error) { if (context.signal?.aborted) throw error; horse.program = undefined; }
      }));
      return horses;
    },
    async detail(id, context) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid horse.');
      // Authorize/profile first: a denied direct link never triggers summary requests.
      const profile = await read(`/api/owner/horses/${id}/profile`, context);
      const [health, training] = await Promise.all([
        read(`/api/owner/horses/${id}/health-summary`, context),
        read(`/api/owner/horses/${id}/training-summary`, context),
      ]);
      return detail(profile, health, training, id);
    },
  };
}
