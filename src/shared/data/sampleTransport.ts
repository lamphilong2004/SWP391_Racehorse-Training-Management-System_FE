import { ApiError } from '../auth/authApi';
import type { RoleCode } from '../auth/roles';
import type { CreateProgramRequest } from '../../features/program-creation/programTypes';
import { validateProgramCreation } from '../../features/program-creation/programDraft';
import { template, sampleUser, readSamples, saveSamples } from './sampleStore';
import type { CurrentUser } from '../auth/authApi';
import { handleHorseSample } from './horseSamples';
import { handleSessionSample } from './sessionSamples';
import type { ExaminationRequest, InjuryRequest, ReexaminationRequest, TreatmentPlanRequest, Incident } from '../../features/medical/models';
import type { EvaluationRequest } from '../../features/evaluation/models';
import { DEMO_UI_ONLY } from '../../demo/demoMode';

/** Explicit temporary business transport. Never calls fetch or falls through to the backend. */
export async function sampleRequest<T>(path: string, init: RequestInit, user: CurrentUser): Promise<T> {
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = new URL(path, 'http://sample.invalid');
  const route = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body && !(init.body instanceof FormData) ? JSON.parse(String(init.body)) : {};
  const data = readSamples();
  if (user.accountStatus !== 'ACTIVE') throw new ApiError(403, 'FORBIDDEN', 'An active sample actor is required.');
  if (user.roles.includes('GROOM') && !data.groomUserIds?.includes(user.id)) {
    data.groomUserIds = [...new Set([sampleUser('GROOM').id, ...(data.groomUserIds ?? []), user.id])];
    saveSamples(data);
  }
  const now = new Date().toISOString();
  const fail = (status: number, message: string): never => { throw new ApiError(status, status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message); };
  const allow = (...roles: RoleCode[]) => { if (!roles.some((role) => user.roles.includes(role))) fail(403, 'This action is unavailable for this signed-in role.'); };
  const respond = (value: unknown): T => { if (method !== 'GET') saveSamples(data); return structuredClone(value) as T; };
  const page = <V>(rows: V[]) => {
    const index = Math.max(0, Number(url.searchParams.get('page')) || 0);
    const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
    return { items: rows.slice(index * size, (index + 1) * size), page: index, size, totalElements: rows.length, totalItems: rows.length, totalPages: Math.ceil(rows.length / size) };
  };
  const find = <V extends { id: number }>(rows: V[], id: number): V => rows.find((item) => item.id === id) ?? fail(404, 'Sample record not found. Reload sample data to restore the starting scenario.');
  if (import.meta.env.DEV && DEMO_UI_ONLY) {
    const { handleDemoSample } = await import('../../demo/demoSamples');
    const demoResponse = handleDemoSample(path, init, user);
    if (demoResponse.handled) return demoResponse.data as T;
  }
  const horseResponse = await handleHorseSample(path, init, user);
  if (horseResponse.handled) return horseResponse.data as T;
  const sessionResponse = handleSessionSample(path, init, user);
  if (sessionResponse.handled) return sessionResponse.data as T;
  if (route.startsWith('/api/program-templates') || /\/(template|trainer)-recommendations$/.test(route)) {
    allow('HEAD_TRAINER');
    if (method !== 'GET') fail(404, 'Template mutations are outside this sample data.');
    if (route === '/api/program-templates') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return respond(page(template.template.name.toLowerCase().includes(q) ? [template.template] : []));
    }
    if (route === '/api/program-templates/3') return respond(template);
    if (route === '/api/horses/7/template-recommendations') return respond([{ templateId: 3, templateCode: 'TPL-003', templateVersionId: 301, versionNo: 1, name: template.version.name, label: 'SUITABLE', reasons: ['Sample endurance profile; Head Trainer decides'] }]);
    if (route === '/api/horses/7/trainer-recommendations') return respond({ candidates: [{ user: sampleUser('TRAINER'), label: 'SUITABLE', reasons: ['Sample endurance experience'], warnings: [], hardBlock: null }] });
  }
  if (route === '/api/training-programs' && method === 'POST') {
    allow('HEAD_TRAINER');
    const input = body as CreateProgramRequest;
    const issues = validateProgramCreation(input);
    if (issues.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Check the program fields.', issues.map((issue) => ({ field: issue.field, message: issue.message })));
    if (input.horseId !== 7 || input.templateVersionId !== 301 || input.trainer.trainerUserId !== 12) fail(400, 'Select the sample horse, template and Trainer.');
    const program = { ...input, id: data.nextId++, horse: data.sessions[0].session.horse, status: 'ACTIVE' as const, sourceTemplateId: 3, sourceTemplateVersion: 1, activatedAt: now, currentTrainer: sampleUser('TRAINER'), phases: input.phases.map((phase) => ({ ...phase, id: data.nextId++, isCustomized: true })) };
    data.programs.push(program);
    return respond(program);
  }
  const programMatch = route.match(/^\/api\/training-programs\/(\d+)$/);
  if (programMatch && method === 'GET') { allow('HEAD_TRAINER', 'TRAINER'); return respond(find(data.programs, Number(programMatch[1]))); }
  const sessionMatch = route.match(/^\/api\/training-sessions\/(\d+)\/(result|evaluation)$/);
  if (sessionMatch) {
    allow('TRAINER', 'HEAD_TRAINER', 'WORK_RIDER', 'CLUB_MANAGER', 'VETERINARIAN');
    const result = data.sessions.find((item) => item.session.id === Number(sessionMatch[1])) ?? fail(404, 'Sample session not found. Use session 42 or 43.');
    if (method === 'GET' && sessionMatch[2] === 'result') return respond(result);
    if (method === 'POST' && sessionMatch[2] === 'evaluation') {
      allow('TRAINER');
      if (!['COMPLETED', 'INTERRUPTED'].includes(result.session.status)) fail(409, 'Only completed or interrupted sessions can be evaluated.');
      if (result.evaluation) fail(409, 'An evaluation is already recorded.');
      const input = body as EvaluationRequest;
      if (!['MET', 'PARTIALLY_MET', 'NOT_MET'].includes(input.result) || [input.evaluatedSummary, input.evaluationNotes, input.recommendation].some((value) => value != null && (typeof value !== 'string' || value.length > 2000))) fail(400, 'Invalid evaluation fields.');
      result.evaluation = { ...input, id: data.nextId++, sessionId: result.session.id, evaluatedBy: user, evaluatedAt: now };
      result.session.hasEvaluation = true;
      // Preserve INTERRUPTED/COMPLETED; metrics are explicit sample values, never recalculated.
      return respond(result.evaluation);
    }
  }
  if (route === '/api/horses/7/performance' && method === 'GET') {
    allow('TRAINER', 'HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN');
    return respond(data.sessions.map(({ session, actual, evaluation }) => ({ sessionId: session.id, sessionCode: session.sessionCode, date: session.scheduledStart.slice(0, 10), status: session.status, totalDistanceM: actual.totalDistanceM, durationMin: actual.durationMin, maxHeartRate: actual.maxHeartRate, avgSpeedKmh: actual.avgSpeedKmh, result: evaluation?.result ?? null })).filter((item) => (!url.searchParams.get('from') || item.date >= url.searchParams.get('from')!) && (!url.searchParams.get('to') || item.date <= url.searchParams.get('to')!)));
  }
  if (route === '/api/incidents' || /^\/api\/incidents\/\d+(\/review)?$/.test(route)) {
    allow('GROOM', 'VETERINARIAN', 'TRAINER', 'HEAD_TRAINER', 'WORK_RIDER', 'CLUB_MANAGER');
    const ownReportsOnly = user.roles.includes('GROOM') && !user.roles.some((role) => ['VETERINARIAN', 'CLUB_MANAGER', 'HEAD_TRAINER'].includes(role));
    if (route === '/api/incidents') {
      if (method === 'GET') return respond(page(ownReportsOnly ? data.incidents.filter((item) => item.reportedByUserId === user.id) : data.incidents));
      if (method === 'POST') {
        allow('GROOM', 'TRAINER', 'HEAD_TRAINER', 'WORK_RIDER');
        if (body.horseId !== 7 || !['LOW', 'MEDIUM', 'HIGH'].includes(body.observedSeverity) || !['OFF_FEED', 'COLIC_SIGNS', 'FEVER', 'HOOF_OR_LEG_PROBLEM', 'OTHER'].includes(body.incidentType) || !Number.isFinite(Date.parse(body.observedAt))) fail(400, 'Choose the sample horse and valid incident fields.');
        const id = data.nextId++;
        const incident: Incident = { horseId: 7, incidentType: body.incidentType, observedSeverity: body.observedSeverity, observedAt: body.observedAt, description: body.description,
          ...(body.careTaskId ? { careTaskId: body.careTaskId } : {}), ...(body.trainingSessionId ? { trainingSessionId: body.trainingSessionId } : {}), ...(body.preSessionCheckId ? { preSessionCheckId: body.preSessionCheckId } : {}),
          id, incidentCode: `INC-${id}`, reportedByUserId: user.id, reportedAt: now, status: 'REPORTED' };
        data.incidents.push(incident); return respond(incident);
      }
    } else {
      const incident = find(data.incidents, Number(route.split('/')[3]));
      if (ownReportsOnly && incident.reportedByUserId !== user.id) fail(403, 'This sample incident belongs to another reporter.');
      if (method === 'GET' && !route.endsWith('/review')) return respond(incident);
      if (method === 'POST' && route.endsWith('/review')) {
        allow('VETERINARIAN');
        if (incident.status === 'RESOLVED') fail(409, 'Resolved incidents cannot be reviewed again.');
        if (body.action === 'RESOLVE') incident.status = 'RESOLVED';
        else if (body.action === 'OPEN_CASE' || body.action === 'LINK_CASE') {
          if (incident.status !== 'REPORTED') fail(409, 'Only a reported incident can be opened or linked to a case.');
          if (incident.medicalCaseId) fail(409, 'This incident is already linked to a case.');
          const item = body.action === 'LINK_CASE' ? find(data.cases, Number(body.medicalCaseId)) : { id: data.nextId++, horseId: 7, status: 'OPEN' as const, openedAt: now, reason: incident.description, incidentIds: [], examinations: [], injuries: [], reexaminations: [] };
          if (item.status !== 'OPEN' || item.horseId !== incident.horseId) fail(409, 'Choose an open case for the same horse.');
          if (body.action === 'OPEN_CASE') data.cases.push(item);
          item.incidentIds.push(incident.id); incident.medicalCaseId = item.id; incident.status = 'UNDER_REVIEW';
        } else fail(400, 'Choose a review action.');
        return respond(incident);
      }
    }
  }
  if (route.startsWith('/api/groom/treatment-tasks')) {
    allow('GROOM');
    const tasks = data.tasks.filter((item) => item.assignedGroomUserId === user.id);
    const safe = (task: typeof tasks[number]) => ({ id: task.id, horseId: task.horseId, assignedGroomUserId: task.assignedGroomUserId, instruction: task.instruction, taskDate: task.taskDate, scheduledSlot: task.scheduledSlot, status: task.status, completedAt: task.completedAt });
    if (route === '/api/groom/treatment-tasks' && method === 'GET') return respond(page(tasks.map(safe)));
    const match = route.match(/^\/api\/groom\/treatment-tasks\/(\d+)\/complete$/);
    if (match && method === 'POST') {
      const task = find(tasks, Number(match[1]));
      if (task.status === 'COMPLETED') fail(409, 'This task is already completed.');
      task.status = 'COMPLETED'; task.completedAt = now; task.completedByUserId = user.id;
      return respond(safe(task));
    }
  }
  if (route.startsWith('/api/medical/')) {
    allow('VETERINARIAN');
    if (route === '/api/medical/herd-health' && method === 'GET') return respond({ totalHorses: 1, fit: Number(data.healthStatus === 'FIT'), monitoring: Number((data.healthStatus ?? 'MONITORING') === 'MONITORING'), injured: Number(data.healthStatus === 'INJURED'), quarantined: Number(data.healthStatus === 'QUARANTINED'), unassessed: 0 });
    if (route === '/api/medical/restrictions' && method === 'GET') return respond(page([]));
    if (route === '/api/medical/cases') {
      if (method === 'GET') return respond(page(data.cases));
      if (method === 'POST') {
        if (body.horseId !== 7 || !body.reason?.trim()) fail(400, 'Use horse 7 and provide a reason.');
        const item = { id: data.nextId++, horseId: 7, reason: body.reason, status: 'OPEN' as const, openedAt: now, incidentIds: [], examinations: [], injuries: [], reexaminations: [] };
        data.cases.push(item); return respond(item);
      }
    }
    const match = route.match(/^\/api\/medical\/cases\/(\d+)(?:\/([\w-]+))?$/);
    if (match) {
      const item = find(data.cases, Number(match[1]));
      const action = match[2];
      if (method === 'GET' && !action) return respond(item);
      if (method === 'GET' && action === 'treatment-tasks') return respond(page(data.tasks.filter((task) => task.caseId === item.id)));
      if (item.status === 'CLOSED') fail(409, 'Closed cases cannot be edited.');
      if (method === 'POST' && action === 'examinations') {
        const input = body as ExaminationRequest;
        if (!input.symptoms?.trim()) fail(400, 'Symptoms are required.');
        const exam = { ...input, id: data.nextId++, caseId: item.id, horseId: item.horseId };
        item.examinations.push(exam); if (input.healthStatus) data.healthStatus = input.healthStatus; return respond(exam);
      }
      if (method === 'POST' && action === 'injuries') {
        const input = body as InjuryRequest;
        if (!input.bodyRegion || !input.severity || !input.recoveryStatus) fail(400, 'Complete the injury fields.');
        const injury = { ...input, id: data.nextId++, caseId: item.id };
        item.injuries.push(injury); return respond(injury);
      }
      if (method === 'PUT' && action === 'treatment-plan') {
        const input = body as TreatmentPlanRequest;
        const knownGroom = (id: number) => Number.isSafeInteger(id) && id > 0 &&
          (id === sampleUser('GROOM').id || data.groomUserIds?.includes(id) || data.tasks.some((task) => task.assignedGroomUserId === id));
        if (!input.treatmentMedicationInstructions?.trim() || input.groomTasks?.some((task) => !knownGroom(task.assignedGroomUserId) || !task.instruction.trim() || !task.taskDate)) fail(400, 'Complete the plan and choose a known active Groom.');
        item.treatmentPlan = { id: item.treatmentPlan?.id ?? data.nextId++, caseId: item.id, treatmentMedicationInstructions: input.treatmentMedicationInstructions, restInstructions: input.restInstructions, careInstructions: input.careInstructions, reexaminationDate: input.reexaminationDate, createdAt: now };
        data.tasks = data.tasks.filter((task) => task.caseId !== item.id || task.status === 'COMPLETED');
        data.tasks.push(...(input.groomTasks ?? []).map((task) => ({ ...task, id: data.nextId++, caseId: item.id, treatmentPlanId: item.treatmentPlan!.id, horseId: item.horseId, status: 'PENDING' as const })));
        return respond(item.treatmentPlan);
      }
      if (method === 'POST' && action === 're-examinations') {
        const input = body as ReexaminationRequest;
        if (!input.findings?.trim() || !['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'].includes(input.recoveryStatus)) fail(400, 'Complete the recovery findings.');
        const exam = { ...input, id: data.nextId++, caseId: item.id, horseId: item.horseId };
        item.reexaminations.push(exam); if (input.healthStatus) data.healthStatus = input.healthStatus; return respond(exam);
      }
      if (method === 'POST' && action === 'close') {
        if ((!item.examinations.length && !item.reexaminations.length) || ((item.injuries.length || item.treatmentPlan) && item.reexaminations.at(-1)?.recoveryStatus !== 'RECOVERED') || data.tasks.some((task) => task.caseId === item.id && task.status !== 'COMPLETED') || data.incidents.some((incident) => incident.medicalCaseId === item.id && incident.status !== 'RESOLVED')) fail(409, 'Complete treatment tasks, resolve linked incidents and record recovery before closing this sample case.');
        item.status = 'CLOSED'; item.closedAt = now; return respond(item);
      }
    }
  }
  return fail(404, `No sample scenario for ${method} ${route}. This mode never falls back to the backend.`);
}
