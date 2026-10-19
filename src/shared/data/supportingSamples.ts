import { ApiError, type CurrentUser } from '../auth/authApi';
import type { RoleCode } from '../auth/roles';
import type { AssignedProgram, CalendarSession, Exercise, ExerciseInput } from '../../features/training/assigned/supportingApi';
import { readSamples, saveSamples } from './sampleStore';

/** CORE-044 operations use the same persisted graph as horse, program, session and medical screens. */
export function handleSupportingSample(path: string, init: RequestInit, actor: CurrentUser): { handled: boolean; data?: unknown } {
  const url = new URL(path, 'http://sample.invalid'), route = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const exerciseMatch = route.match(/^\/api\/exercises(?:\/(\d+))?$/);
  if (!exerciseMatch && !(method === 'GET' && ['/api/training-programs', '/api/training-sessions'].includes(route))) return { handled: false };
  const fail = (status: number, message: string): never => { throw new ApiError(status, status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message); };
  const allow = (...roles: RoleCode[]) => { if (!actor.roles.some((role) => roles.includes(role))) fail(403, 'This action is outside your role.'); };
  allow('TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', ...(exerciseMatch || route === '/api/training-sessions' ? ['WORK_RIDER' as const] : ['GROOM' as const]));
  const data = readSamples();
  const privileged = actor.roles.some((role) => ['HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN'].includes(role));
  const send = (value: unknown) => ({ handled: true, data: structuredClone(value) });
  if (route === '/api/training-programs') {
    const page = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 20);
    if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1) fail(400, 'Invalid pagination.');
    const ownOnly = (!privileged && actor.roles.includes('TRAINER')) || url.searchParams.get('assignedToMe') === 'true';
    const rows: AssignedProgram[] = data.programs.filter((program) =>
      (!ownOnly || program.currentTrainer?.id === actor.id) &&
      (!url.searchParams.has('status') || program.status === url.searchParams.get('status')) &&
      (!url.searchParams.has('horseId') || program.horse.id === Number(url.searchParams.get('horseId')))
    ).map((program) => ({
      id: program.id, horse: program.horse, name: program.name, status: program.status,
      periodStart: program.periodStart, periodEnd: program.periodEnd,
      sourceTemplateId: program.sourceTemplateId, sourceTemplateVersion: program.sourceTemplateVersion,
      currentTrainer: program.currentTrainer,
      currentPhaseName: program.phases.find((phase) => phase.startDate <= new Date().toISOString().slice(0, 10) && phase.endDate >= new Date().toISOString().slice(0, 10))?.name ?? null,
      trainingAvailability: data.horseRegistry?.records.find((horse) => horse.id === program.horse.id)?.trainingAvailability,
    }));
    return send({ items: rows.slice(page * size, (page + 1) * size), page, size, totalItems: rows.length, totalPages: Math.ceil(rows.length / size) });
  }
  if (route === '/api/training-sessions') {
    const from = Date.parse(url.searchParams.get('from') ?? ''), to = Date.parse(url.searchParams.get('to') ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) fail(400, 'A valid from/to range is required.');
    const rows: CalendarSession[] = data.sessions.map((item) => item.session).filter((session) => {
      const time = Date.parse(session.scheduledStart);
      const visible = privileged || (actor.roles.includes('TRAINER') && session.trainer?.id === actor.id) || (actor.roles.includes('WORK_RIDER') && session.workRider.id === actor.id);
      return visible && time >= from && time < to && ['programId', 'horseId', 'trainerId', 'status'].every((key) => {
        const filter = url.searchParams.get(key);
        return !filter || filter === String(key === 'programId' ? session.programId : key === 'horseId' ? session.horse.id : key === 'trainerId' ? session.trainer?.id : session.status);
      });
    }).map(({ id, sessionCode, horse, programId, phaseName, scheduledStart, scheduledEnd, status, workRider, trainer, blocked, blockedReasons, blockedMessage, preCheckResult }) =>
      ({ id, sessionCode, horse, programId, phaseName, scheduledStart, scheduledEnd, status, workRider, trainer, blocked: blocked ?? false, blockedReasons: blockedReasons ?? [], blockedMessage, preCheckResult }));
    return send(rows);
  }
  if (!data.exercises) {
    const definitions = data.sessions.flatMap((item) => item.session.exercises);
    data.exercises = [...new Map(definitions.map((exercise) => [exercise.exerciseDefinitionId, { id: exercise.exerciseDefinitionId, name: exercise.exerciseName, exerciseType: null, description: null, targetMetric: null }])).values()];
    saveSamples(data);
  }
  const id = exerciseMatch?.[1] ? Number(exerciseMatch[1]) : undefined;
  if (method === 'GET') {
    if (id !== undefined) return send(data.exercises.find((exercise) => exercise.id === id) ?? fail(404, 'Exercise not found.'));
    const query = url.searchParams.get('q')?.toLowerCase() ?? '', type = url.searchParams.get('exerciseType');
    return send(data.exercises.filter((exercise) => (!query || `${exercise.name} ${exercise.description ?? ''}`.toLowerCase().includes(query)) && (!type || exercise.exerciseType === type)));
  }
  allow('HEAD_TRAINER', 'TRAINER');
  if ((method !== 'POST' || id !== undefined) && (method !== 'PUT' || id === undefined)) fail(400, 'Unsupported exercise operation.');
  let body: ExerciseInput;
  try { body = JSON.parse(String(init.body ?? '{}')) as ExerciseInput; } catch { return fail(400, 'Invalid exercise payload.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['name', 'exerciseType', 'description', 'targetMetric'].includes(key))) fail(400, 'Only approved ExerciseInput fields are accepted.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 150) fail(400, 'Exercise name must contain 1–150 characters.');
  for (const [key, limit] of [['exerciseType', 50], ['description', 2000], ['targetMetric', 100]] as const) {
    const value = body[key];
    if (value != null && (typeof value !== 'string' || value.length > limit)) fail(400, `Invalid ${key}.`);
  }
  const existing = id !== undefined ? data.exercises.find((exercise) => exercise.id === id) ?? fail(404, 'Exercise not found.') : null;
  const exercise: Exercise = { id: existing?.id ?? data.nextId++, name: body.name.trim(), exerciseType: body.exerciseType ?? null, description: body.description ?? null, targetMetric: body.targetMetric ?? null };
  if (existing) data.exercises[data.exercises.indexOf(existing)] = exercise; else data.exercises.push(exercise);
  saveSamples(data);
  return send(exercise);
}
