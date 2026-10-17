import type { CurrentUser } from '../shared/auth/authApi';
import type { CaseTreatmentTask, HealthStatus, MedicalCase, MedicalRestriction, TreatmentPlanRequest } from '../features/medical/models';
import type { Incident, IncidentCreateRequest } from '../features/core046/contract';

const STORAGE_KEY = 'racehorse.medical-demo.v2';
interface MockDatabase {
  version: 2;
  groomUserId: number;
  nextId: number;
  cases: MedicalCase[];
  incidents: Incident[];
  tasks: CaseTreatmentTask[];
  restrictions: MedicalRestriction[];
  health: Record<number, HealthStatus>;
}

function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function seed(): MockDatabase {
  const now = new Date().toISOString();
  const groomId = Number(import.meta.env.VITE_DEMO_GROOM_USER_ID) || 0;
  return {
    version: 2, nextId: 1000, groomUserId: groomId,
    health: { 101: 'MONITORING', 102: 'FIT', 103: 'INJURED', 104: 'QUARANTINED' },
    cases: [
      { id: 1, horseId: 101, status: 'OPEN', openedAt: now, reason: 'Follow-up for left forelimb swelling', incidentIds: [21], examinations: [{ id: 11, caseId: 1, horseId: 101, examinedAt: now, symptoms: 'Mild swelling', diagnosis: 'Soft tissue strain', severity: 'MILD', healthStatus: 'MONITORING' }], injuries: [{ id: 12, caseId: 1, bodyRegion: 'LEFT_FORELIMB', severity: 'MILD', recoveryStatus: 'IMPROVING' }], treatmentPlan: { id: 31, caseId: 1, treatmentMedicationInstructions: 'Follow the prescribed veterinary treatment.', restInstructions: 'No ridden exercise until reviewed.', careInstructions: 'Check the affected limb daily.', reexaminationDate: day(3), createdAt: now }, reexaminations: [] },
      { id: 2, horseId: 102, status: 'OPEN', openedAt: now, reason: 'Routine observation after reduced appetite', incidentIds: [], examinations: [], injuries: [], reexaminations: [] },
    ],
    incidents: [
      { id: 21, incidentCode: 'INC-021', horseId: 101, reportedByUserId: groomId, medicalCaseId: 1, incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'MEDIUM', description: 'Swelling noticed during morning care.', observedAt: now, reportedAt: now, status: 'UNDER_REVIEW' },
      { id: 22, incidentCode: 'INC-022', horseId: 102, reportedByUserId: groomId, incidentType: 'OFF_FEED', observedSeverity: 'LOW', description: 'Did not finish the morning feed.', observedAt: now, reportedAt: now, status: 'REPORTED' },
      { id: 23, incidentCode: 'INC-023', horseId: 103, reportedByUserId: 900000003, incidentType: 'FEVER', observedSeverity: 'HIGH', description: 'Elevated temperature reported by another Groom.', observedAt: now, reportedAt: now, status: 'REPORTED' },
    ],
    tasks: [
      { id: 41, caseId: 1, treatmentPlanId: 31, horseId: 101, assignedGroomUserId: groomId, instruction: 'Check left forelimb and report any increased swelling.', taskDate: day(), scheduledSlot: 'Morning', status: 'PENDING' },
      { id: 42, caseId: 1, treatmentPlanId: 31, horseId: 101, assignedGroomUserId: groomId, instruction: 'Check appetite and water intake.', taskDate: day(1), scheduledSlot: 'Evening', status: 'PENDING' },
      { id: 43, caseId: 1, treatmentPlanId: 31, horseId: 101, assignedGroomUserId: 900000003, instruction: 'Check bedding in the assigned stall.', taskDate: day(), status: 'PENDING' },
      { id: 44, caseId: 1, treatmentPlanId: 31, horseId: 101, assignedGroomUserId: groomId, instruction: 'Record the morning observation.', taskDate: day(-1), status: 'COMPLETED', completedAt: now, completedByUserId: groomId },
    ],
    restrictions: [{ id: 51, horseId: 101, level: 'LIMITED', reason: 'Veterinary review required before ridden exercise.', effectiveAt: now, medicalCaseId: 1 }],
  };
}

let memory: MockDatabase | undefined;
function database(actor: CurrentUser): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as MockDatabase;
      if (saved.version === 2 && Array.isArray(saved.cases) && Array.isArray(saved.tasks) && Array.isArray(saved.incidents) && Array.isArray(saved.restrictions) && saved.health && Number.isSafeInteger(saved.nextId)) return bindGroom(saved, actor);
    }
  } catch { /* Use in-memory data if browser storage is unavailable. */ }
  memory ??= seed();
  persist(memory);
  return bindGroom(memory, actor);
}
function bindGroom(db: MockDatabase, actor: CurrentUser): MockDatabase {
  if (db.groomUserId === 0 && actor.roles.includes('GROOM')) {
    db.groomUserId = actor.id;
    db.tasks.forEach((task) => { if (task.assignedGroomUserId === 0) { task.assignedGroomUserId = actor.id; if (task.completedByUserId === 0) task.completedByUserId = actor.id; } });
    db.incidents.forEach((incident) => { if (incident.reportedByUserId === 0) incident.reportedByUserId = actor.id; });
    persist(db);
  }
  return db;
}
function persist(db: MockDatabase) {
  memory = db;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* Session-only demo. */ }
}
export function resetMedicalDemo() { memory = seed(); persist(memory); }

class MockFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
function reject(status: number, code: string, message: string): never { throw new MockFailure(status, code, message); }
function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) reject(400, 'VALIDATION_ERROR', `${name} is required.`);
  return value.trim();
}
function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) reject(400, 'VALIDATION_ERROR', 'A positive numeric ID is required.');
  return value;
}
function paged<T>(items: T[], url: URL) {
  const page = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 20);
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100) reject(400, 'VALIDATION_ERROR', 'Invalid pagination.');
  return { items: items.slice(page * size, (page + 1) * size), page, size, totalElements: items.length };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
}
function findCase(db: MockDatabase, id: number, writable = false) {
  const item = db.cases.find((entry) => entry.id === id);
  if (!item) reject(404, 'NOT_FOUND', 'Medical case not found.');
  if (writable && item.status === 'CLOSED') reject(409, 'CONFLICT', 'Closed cases cannot be edited.');
  return item;
}
function newCase(db: MockDatabase, horseId: number, reason: string): MedicalCase {
  const item: MedicalCase = { id: db.nextId++, horseId, reason, status: 'OPEN', openedAt: new Date().toISOString(), incidentIds: [], examinations: [], injuries: [], reexaminations: [] };
  db.cases.unshift(item);
  return item;
}

/** Demo data uses the existing authenticated BE actor; it never issues or stores credentials. */
export function createMedicalDemoFetch(user: CurrentUser): typeof fetch {
  return async (input, init) => {
  const delay = Math.min(1500, Math.max(0, Number(import.meta.env.VITE_DEMO_DELAY_MS ?? 150) || 0));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  try {
    if (!Number.isSafeInteger(user.id) || user.id < 1 || user.accountStatus !== 'ACTIVE') reject(403, 'FORBIDDEN', 'An active authenticated account is required.');
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://demo.local');
    const path = url.pathname, method = init?.method ?? 'GET';
    if (path.startsWith('/api/auth/')) reject(404, 'NOT_FOUND', 'Authentication must use the shared backend service.');
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try { body = JSON.parse(String(init.body)) as Record<string, unknown>; }
      catch { reject(400, 'VALIDATION_ERROR', 'Invalid JSON request.'); }
    }
    const db = database(user);
    const vet = user.roles.includes('VETERINARIAN');
    const groom = user.roles.includes('GROOM');
    if (path.startsWith('/api/medical/') && !vet) reject(403, 'FORBIDDEN', 'Veterinarian access is required.');
    let data: unknown;
    let status = 200;
    const caseRoute = path.match(/^\/api\/medical\/cases\/(\d+)(?:\/([a-z-]+))?$/);
    const incidentRoute = path.match(/^\/api\/incidents\/(\d+)(?:\/(review))?$/);
    const completeRoute = path.match(/^\/api\/groom\/treatment-tasks\/(\d+)\/complete$/);
    const availabilityRoute = path.match(/^\/api\/horses\/(\d+)\/training-availability$/);
    if (path === '/api/medical/cases' && method === 'GET') data = paged(db.cases, url);
    else if (path === '/api/medical/cases' && method === 'POST') { data = newCase(db, positive(body.horseId), required(body.reason, 'Reason')); status = 201; }
    else if (path === '/api/medical/herd-health' && method === 'GET') {
      const health = Object.values(db.health);
      data = { totalHorses: health.length, fit: health.filter((v) => v === 'FIT').length, monitoring: health.filter((v) => v === 'MONITORING').length, injured: health.filter((v) => v === 'INJURED').length, quarantined: health.filter((v) => v === 'QUARANTINED').length, unassessed: 0 };
    } else if (path === '/api/medical/restrictions' && method === 'GET') data = paged(db.restrictions, url);
    else if (availabilityRoute && method === 'GET') {
      const horseId = Number(availabilityRoute[1]);
      const active = db.restrictions.filter((entry) => entry.horseId === horseId && !entry.liftedAt);
      const restriction = active.find((entry) => entry.level === 'LOCKED') ?? active[0];
      data = { horseId, availability: restriction?.level ?? 'AVAILABLE', reason: restriction?.reason, activeRestrictionId: restriction?.id, exerciseRules: restriction?.exerciseRules };
    } else if (caseRoute) {
      const item = findCase(db, Number(caseRoute[1]), method !== 'GET'), action = caseRoute[2];
      if (!action && method === 'GET') data = item;
      else if (action === 'treatment-tasks' && method === 'GET') data = paged(db.tasks.filter((entry) => entry.caseId === item.id), url);
      else if (action === 'examinations' && method === 'POST') {
        const exam = { id: db.nextId++, caseId: item.id, horseId: item.horseId, symptoms: required(body.symptoms, 'Symptoms'), examinedAt: required(body.examinedAt, 'Examination time'), diagnosis: body.diagnosis as string | undefined, severity: body.severity as 'MILD' | 'MODERATE' | 'SEVERE' | undefined, healthStatus: body.healthStatus as HealthStatus | undefined };
        item.examinations.push(exam); if (exam.healthStatus) db.health[item.horseId] = exam.healthStatus; data = exam; status = 201;
      } else if (action === 'injuries' && method === 'POST') {
        const injury = { ...body, id: db.nextId++, caseId: item.id, bodyRegion: required(body.bodyRegion, 'Body region') } as MedicalCase['injuries'][number];
        item.injuries.push(injury); data = injury; status = 201;
      } else if (action === 'treatment-plan' && method === 'PUT') {
        const plan = body as unknown as TreatmentPlanRequest;
        required(plan.treatmentMedicationInstructions, 'Treatment instructions');
        for (const task of plan.groomTasks ?? []) {
          positive(task.assignedGroomUserId);
          required(task.instruction, 'Groom-safe instruction'); required(task.taskDate, 'Task date');
        }
        const { groomTasks = [], ...details } = plan;
        const treatment = { ...details, id: item.treatmentPlan?.id ?? db.nextId++, caseId: item.id, createdAt: new Date().toISOString() };
        db.tasks = db.tasks.filter((entry) => entry.caseId !== item.id || entry.status === 'COMPLETED');
        db.tasks.push(...groomTasks.map((entry) => ({ ...entry, id: db.nextId++, caseId: item.id, treatmentPlanId: treatment.id, horseId: item.horseId, status: 'PENDING' as const })));
        item.treatmentPlan = treatment; data = treatment;
      } else if (action === 're-examinations' && method === 'POST') {
        const review = { ...body, id: db.nextId++, caseId: item.id, horseId: item.horseId, findings: required(body.findings, 'Findings'), examinedAt: required(body.examinedAt, 'Examination time') } as MedicalCase['reexaminations'][number];
        item.reexaminations.push(review); if (body.healthStatus) db.health[item.horseId] = body.healthStatus as HealthStatus; data = review; status = 201;
      } else if (action === 'close' && method === 'POST') {
        if (!item.examinations.length && !item.reexaminations.length) reject(409, 'CONFLICT', 'Add an examination before closing the case.');
        if ((item.injuries.length || item.treatmentPlan) && item.reexaminations.at(-1)?.recoveryStatus !== 'RECOVERED') reject(409, 'CONFLICT', 'The latest re-examination must confirm RECOVERED.');
        if (db.tasks.some((entry) => entry.caseId === item.id && entry.status !== 'COMPLETED')) reject(409, 'CONFLICT', 'Complete assigned treatment tasks before closing the case.');
        if (db.incidents.some((entry) => entry.medicalCaseId === item.id && entry.status !== 'RESOLVED')) reject(409, 'CONFLICT', 'Resolve linked incidents before closing the case.');
        if (db.restrictions.some((entry) => entry.medicalCaseId === item.id && !entry.liftedAt)) reject(409, 'CONFLICT', 'The active restriction requires a separate review.');
        item.status = 'CLOSED'; item.closedAt = new Date().toISOString(); data = item;
      } else reject(404, 'NOT_FOUND', 'This mock operation is not available.');
    } else if (path === '/api/groom/treatment-tasks' && method === 'GET') {
      if (!groom) reject(403, 'FORBIDDEN', 'Groom access is required.');
      data = paged(db.tasks.filter((entry) => entry.assignedGroomUserId === user.id).map(({ id, horseId, assignedGroomUserId, instruction, taskDate, scheduledSlot, status, completedAt }) => ({ id, horseId, assignedGroomUserId, instruction, taskDate, scheduledSlot, status, completedAt })), url);
    } else if (completeRoute && method === 'POST') {
      if (!groom) reject(403, 'FORBIDDEN', 'Groom access is required.');
      const task = db.tasks.find((entry) => entry.id === Number(completeRoute[1]) && entry.assignedGroomUserId === user.id);
      if (!task) reject(404, 'NOT_FOUND', 'Assigned treatment task not found.');
      if (task.status === 'COMPLETED') reject(409, 'CONFLICT', 'This task is already completed.');
      task.status = 'COMPLETED'; task.completedAt = new Date().toISOString(); task.completedByUserId = user.id;
      const { id, horseId, assignedGroomUserId, instruction, taskDate, scheduledSlot, status, completedAt } = task;
      data = { id, horseId, assignedGroomUserId, instruction, taskDate, scheduledSlot, status, completedAt };
    } else if (path === '/api/incidents' && method === 'GET') data = paged(db.incidents.filter((entry) => vet || entry.reportedByUserId === user.id), url);
    else if (path === '/api/incidents' && method === 'POST') {
      if (!groom) reject(403, 'FORBIDDEN', 'Use the Groom demo to report an incident.');
      const request = body as unknown as IncidentCreateRequest;
      positive(request.horseId); required(request.incidentType, 'Incident type'); required(request.observedSeverity, 'Severity');
      const observedAt = Date.parse(required(request.observedAt, 'Observed time'));
      if (!Number.isFinite(observedAt) || observedAt > Date.now()) reject(400, 'VALIDATION_ERROR', 'Observed time must be valid and cannot be in the future.');
      if (request.careTaskId && !db.tasks.some((entry) => entry.id === request.careTaskId && entry.assignedGroomUserId === user.id && entry.horseId === request.horseId)) reject(403, 'FORBIDDEN', 'The source task is not assigned to you.');
      const incident: Incident = { ...request, id: db.nextId++, incidentCode: `INC-${db.nextId - 1}`, reportedByUserId: user.id, reportedAt: new Date().toISOString(), status: 'REPORTED' };
      db.incidents.unshift(incident); data = incident; status = 201;
    } else if (incidentRoute) {
      const incident = db.incidents.find((entry) => entry.id === Number(incidentRoute[1]) && (vet || entry.reportedByUserId === user.id));
      if (!incident) reject(404, 'NOT_FOUND', 'Incident not found.');
      if (!incidentRoute[2] && method === 'GET') data = incident;
      else if (incidentRoute[2] && method === 'POST') {
        if (!vet) reject(403, 'FORBIDDEN', 'Veterinarian access is required.');
        if (incident.status === 'RESOLVED') reject(409, 'CONFLICT', 'This incident has already been resolved.');
        if (body.action === 'RESOLVE') incident.status = 'RESOLVED';
        else if (body.action === 'OPEN_CASE' || body.action === 'LINK_CASE') {
          if (incident.medicalCaseId) reject(409, 'CONFLICT', 'The incident already has a medical case.');
          const item = body.action === 'OPEN_CASE' ? newCase(db, incident.horseId, incident.description ?? incident.incidentType) : findCase(db, positive(body.medicalCaseId), true);
          if (item.horseId !== incident.horseId) reject(409, 'CONFLICT', 'Case belongs to another horse');
          item.incidentIds.push(incident.id); incident.medicalCaseId = item.id; incident.status = 'UNDER_REVIEW';
        } else reject(400, 'VALIDATION_ERROR', 'Choose a supported review action.');
        data = incident;
      } else reject(404, 'NOT_FOUND', 'This mock operation is not available.');
    } else reject(404, 'NOT_FOUND', `No mock data handler for ${method} ${path}.`);
    if (method !== 'GET') persist(db);
    return response(data, status);
  } catch (error) {
    const failure = error instanceof MockFailure ? error : new MockFailure(500, 'INTERNAL_ERROR', 'Could not process the local demo data. Reset the demo and try again.');
    return new Response(JSON.stringify({ success: false, error: { code: failure.code, message: failure.message, details: [] } }), { status: failure.status, headers: { 'Content-Type': 'application/json' } });
  }
};
}
