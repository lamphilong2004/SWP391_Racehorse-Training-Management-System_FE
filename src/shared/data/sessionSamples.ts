import { ApiError, type CurrentUser } from '../auth/authApi';
import { CHECK_ITEMS, type Checklist } from '../../features/precheck/types';
import { readSamples, saveSamples, type SampleData } from './sampleStore';
import type { SessionDetail } from '../../features/evaluation/models';

export function canReadSampleSession(data: Pick<SampleData, 'programs'>, session: SessionDetail, actor: CurrentUser): boolean {
  return actor.roles.some((role) => ['HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN'].includes(role))
    || actor.roles.includes('GROOM') // Groom assignment persistence is still a declared CORE-026 model dependency.
    || (actor.roles.includes('WORK_RIDER') && session.workRider.id === actor.id)
    || (actor.roles.includes('TRAINER') && data.programs.some((program) => program.id === session.programId && program.currentTrainer?.id === actor.id));
}

/** Explicit business-only samples; the signed-in actor still comes from the real auth provider. */
export function handleSessionSample(path: string, init: RequestInit, actor: CurrentUser): { handled: boolean; data?: unknown } {
  const url = new URL(path, 'http://sample.invalid'), route = url.pathname, method = (init.method ?? 'GET').toUpperCase();
  const match = route.match(/^\/api\/training-sessions\/(\d+)(?:\/(pre-session-check|start|complete|report-issue|rider-feedback|metrics))?$/);
  if (!match && !route.startsWith('/api/groom/sessions') && !route.startsWith('/api/work-rider/')) return { handled: false };
  const data = readSamples(), now = new Date().toISOString();
  const fail = (status: number, message: string): never => { throw new ApiError(status, status === 403 ? 'FORBIDDEN' : status === 409 ? 'BUSINESS_RULE_VIOLATION' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message); };
  const allow = (...roles: string[]) => { if (!actor.roles.some((role) => roles.includes(role))) fail(403, 'This action is outside your role.'); };
  const send = (value: unknown) => { saveSamples(data); return { handled: true, data: structuredClone(value) }; };
  if (route === '/api/groom/sessions' && method === 'GET') { allow('GROOM'); return send(data.sessions.filter((item) => item.session.status === 'SCHEDULED' && item.session.scheduledStart.slice(0, 10) === (url.searchParams.get('date') ?? now.slice(0, 10))).map((item) => item.session)); }
  if (route === '/api/work-rider/assignments' && method === 'GET') { allow('WORK_RIDER'); const status = url.searchParams.get('status'); return send(data.sessions.filter((item) => item.session.workRider.id === actor.id && (status ? item.session.status === status : ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'].includes(item.session.status))).map((item) => item.session)); }
  if (route === '/api/work-rider/history' && method === 'GET') {
    allow('WORK_RIDER'); const rows = data.sessions.filter((item) => item.session.workRider.id === actor.id && ['COMPLETED', 'INTERRUPTED'].includes(item.session.status)).map((item) => item.session).sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
    const page = Math.max(0, Number(url.searchParams.get('page')) || 0), size = Math.max(1, Number(url.searchParams.get('size')) || 20);
    return send({ items: rows.slice(page * size, (page + 1) * size), page, size, totalItems: rows.length, totalPages: Math.ceil(rows.length / size) });
  }
  if (!match) return { handled: false };
  allow('GROOM', 'WORK_RIDER', 'TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER');
  const item = data.sessions.find((result) => result.session.id === Number(match[1])) ?? fail(404, 'Session not found.');
  const session = item.session, action = match[2];
  if (!canReadSampleSession(data, session, actor)) fail(403, 'This session is outside your assignment.');
  if (method === 'POST' && ['complete', 'rider-feedback', 'metrics'].includes(action ?? '') && session.workRider.id !== actor.id) fail(403, 'Only the assigned Work Rider may perform this action.');
  if (method === 'GET' && !action) return send(session);
  if (method !== 'POST') return { handled: false };
  const input = init.body ? JSON.parse(String(init.body)) : {};
  if (action === 'pre-session-check') {
    allow('GROOM');
    if (session.status !== 'SCHEDULED' || session.preSessionCheck) fail(409, 'This session already has a check or is no longer scheduled. Reload its current state.');
    const checks = input.checks as Checklist;
    if (Object.keys(input).some((key) => key !== 'checks') || !checks || Object.keys(checks).length !== 5 || CHECK_ITEMS.some(({ key }) => !checks[key] || !['NORMAL', 'ABNORMAL'].includes(checks[key].result) || (checks[key].observation?.length ?? 0) > 1000)) fail(400, 'Complete exactly the five approved check items.');
    const overallResult = CHECK_ITEMS.some(({ key }) => checks[key].result === 'ABNORMAL') ? 'ABNORMAL' : 'ALL_NORMAL';
    session.preSessionCheck = { id: data.nextId++, sessionId: session.id, checks, overallResult, performedBy: actor, performedAt: now };
    session.preCheckResult = overallResult; session.blocked = overallResult === 'ABNORMAL'; session.blockedReasons = overallResult === 'ABNORMAL' ? ['PRE_CHECK_ABNORMAL'] : [];
    return send(session.preSessionCheck);
  }
  if (action === 'start') {
    allow('WORK_RIDER', 'TRAINER');
    if (session.status !== 'SCHEDULED' || session.blocked || session.preCheckResult !== 'ALL_NORMAL' || session.trainingAvailability === 'LOCKED' || data.programs.find((program) => program.id === session.programId)?.status !== 'ACTIVE' || new Date(session.scheduledStart).getTime() > Date.now()) fail(409, 'Session cannot start: review the program, scheduled time, Groom precheck and medical restrictions.');
    session.status = 'IN_PROGRESS'; session.actualStart = now; return send(session);
  }
  if (action === 'complete') {
    allow('WORK_RIDER'); if (session.status !== 'IN_PROGRESS') fail(409, 'Only an IN_PROGRESS session can be completed. An interrupted or paused session cannot finish.');
    session.status = 'COMPLETED'; session.actualEnd = now; return send(session);
  }
  if (action === 'report-issue') {
    allow('WORK_RIDER', 'TRAINER');
    if (!['IN_PROGRESS', 'PAUSED'].includes(session.status)) fail(409, 'Report an in-session issue only while the session is active or paused.');
    if (!input.description?.trim() || input.description.length > 1000 || !['LOW', 'MEDIUM', 'HIGH'].includes(input.observedSeverity) || !['OFF_FEED', 'COLIC_SIGNS', 'FEVER', 'HOOF_OR_LEG_PROBLEM', 'OTHER'].includes(input.incidentType)) fail(400, 'Describe the observation and select the type and severity.');
    const id = data.nextId++, incidentCode = `INC-${id}`;
    data.incidents.push({ id, incidentCode, horseId: session.horse.id, trainingSessionId: session.id, reportedByUserId: actor.id, description: input.description, incidentType: input.incidentType, observedSeverity: input.observedSeverity, observedAt: input.observedAt ?? now, reportedAt: now, status: 'REPORTED' });
    session.status = 'INTERRUPTED'; session.actualEnd = now; session.interruptionReason = input.description;
    return send({ incidentId: id, incidentCode, sessionStatus: session.status });
  }
  if (action === 'rider-feedback') {
    allow('WORK_RIDER');
    if (!['COMPLETED', 'INTERRUPTED'].includes(session.status) || session.hasRiderFeedback || item.riderFeedback) fail(409, 'Feedback requires a terminal session and can only be submitted once.');
    const limits: Record<string, number> = { horseResponse: 500, balance: 500, breathing: 500, strideFeeling: 500, abnormalBehavior: 500, preInterruptionDescription: 1000, notes: 1000 };
    if (!input.responses || Object.keys(input).some((key) => key !== 'responses') || Object.entries(input.responses).some(([key, value]) => !(key in limits) || (value != null && (typeof value !== 'string' || value.length > limits[key])))) fail(400, 'Feedback does not match the approved fields.');
    item.riderFeedback = { id: data.nextId++, sessionId: session.id, submittedBy: actor, submittedAt: now, responses: input.responses }; session.hasRiderFeedback = true;
    return send(item.riderFeedback);
  }
  if (action === 'metrics') {
    allow('WORK_RIDER'); if (!['IN_PROGRESS', 'PAUSED'].includes(session.status)) fail(409, 'Metrics require an active or paused session.');
    const values = [input.heartRate, input.speedKmh, input.distanceM];
    if (!input.recordedAt || !Number.isFinite(Date.parse(input.recordedAt)) || values.every((value) => value == null) || values.some((value) => value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) || (input.heartRate != null && !Number.isInteger(input.heartRate))) fail(400, 'Enter a recorded time and at least one valid non-negative metric.');
    (item.samples ??= []).push({ recordedAt: input.recordedAt, source: 'MANUAL', heartRate: input.heartRate ?? null, speedKmh: input.speedKmh ?? null, distanceM: input.distanceM ?? null });
    item.actual.sampleCount = item.samples.length;
    // Sample recording does not invent an aggregate-distance formula or medical threshold evaluation.
    return send({ sampleId: data.nextId++, realtimeState: 'NORMAL', alertId: null });
  }
  return { handled: false };
}
