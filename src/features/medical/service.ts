import type { CaseView, MedicalActor, MedicalService, TaskView } from './models';

/**
 * Explicit opt-in only. No HTTP draft medical routes are enabled.
 * CORE-037 must provide approved read projections and production adapters.
 */
export function createMedicalService(actor: MedicalActor, mock: boolean): MedicalService {
  if (mock) return createMockMedicalService(actor);
  const unavailable = async (): Promise<never> => {
    throw new Error('Medical API is unavailable. CORE-006 approval and CORE-037 integration are required.');
  };
  return { mode: 'unavailable', listCases: unavailable, getCase: unavailable, createCase: unavailable,
    addExamination: unavailable, addInjury: unavailable, saveTreatment: unavailable,
    addReexamination: unavailable, closeCase: unavailable, listIncidents: unavailable,
    listTasks: unavailable, completeTask: unavailable };
}

export interface MockOptions { delayMs?: number; empty?: boolean; fail?: boolean }

/** In-memory per-session simulator. Assignments never cross the service boundary. */
export function createMockMedicalService(actor: MedicalActor, options: MockOptions = {}): MedicalService {
  const cases: CaseView[] = options.empty ? [] : [{
    id: 'MED-02', horseId: 'ST-014', incidentId: 'INC-02', reason: 'Left forelimb lameness', status: 'OPEN',
    examinations: [{ id: 'EX-02', caseId: 'MED-02', symptoms: 'Uneven gait', diagnosis: 'Left forelimb lameness', severity: 'Mild' }],
    injuries: [{ id: 'INJ-02', caseId: 'MED-02', bodyRegion: 'Left Forelimb', severity: 'Mild', recoveryStatus: 'IMPROVING', position3d: { x: 0.4, y: 0.2, z: 0.1 } }],
    treatment: { id: 'TP-02', caseId: 'MED-02', restInstructions: 'Box rest; follow the veterinarian instructions.', medications: [], groomTasks: [{ instruction: 'Apply cold compress as instructed.' }], reexaminationDate: '2026-10-27' },
    reexaminations: [{ id: 'RE-02', caseId: 'MED-02', recoveryStatus: 'IMPROVING', findings: 'Gait improving; continue care.' }],
  }];
  // Assignment metadata is internal fixture data, never added to draft DTOs.
  const tasks: (TaskView & { assignedTo: number })[] = options.empty ? [] : [
    { id: 'TASK-02', horseId: 'ST-014', caseId: 'MED-02', instruction: 'Apply cold compress as instructed. Report any increased swelling to the veterinarian.', status: 'PENDING', assignedTo: 6 },
    { id: 'TASK-03', horseId: 'TB-001', instruction: 'Check dressing after treatment.', status: 'COMPLETED', assignedTo: 6 },
    { id: 'TASK-PRIVATE', horseId: 'NR-003', instruction: 'Private assignment', status: 'PENDING', assignedTo: 99 },
  ];
  let sequence = 10;
  const nextId = (prefix: string) => prefix + '-' + ++sequence;
  const copy = <T,>(value: T): T => structuredClone(value);
  const check = async (role: 'VETERINARIAN' | 'GROOM') => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (actor.accountStatus !== 'ACTIVE' || !actor.roles.includes(role)) throw new Error('Forbidden');
    if (options.fail) throw new Error('Simulated service failure. No changes saved.');
  };
  const required = (value: string | undefined, label: string) => {
    if (!value?.trim()) throw new Error(label + ' is required');
  };
  const get = (id: string) => {
    const found = cases.find((item) => item.id === id);
    if (!found) throw new Error('Medical case not found');
    return found;
  };
  const writable = (id: string) => {
    const found = get(id);
    if (found.status === 'CLOSED') throw new Error('Case is closed');
    return found;
  };
  return {
    mode: 'mock',
    async listCases() { await check('VETERINARIAN'); return copy(cases.map(({ id, horseId, incidentId, status, reason }) => ({ id, horseId, incidentId, status, reason }))); },
    async getCase(id) { await check('VETERINARIAN'); return copy(get(id)); },
    async createCase(input) {
      await check('VETERINARIAN'); required(input.horseId, 'Horse ID'); required(input.reason, 'Reason');
      const item: CaseView = { ...copy(input), id: nextId('MED'), status: 'OPEN', examinations: [], injuries: [], reexaminations: [] };
      cases.push(item); return copy(item);
    },
    async addExamination(id, input) {
      await check('VETERINARIAN'); required(input.symptoms, 'Symptoms');
      writable(id).examinations.push({ id: nextId('EX'), caseId: id, ...copy(input) });
    },
    async addInjury(id, input) {
      await check('VETERINARIAN'); required(input.bodyRegion, 'Body region'); required(input.severity, 'Severity');
      if (input.position3d && !Object.values(input.position3d).every(Number.isFinite)) throw new Error('Coordinates must be finite numbers');
      writable(id).injuries.push({ id: nextId('INJ'), caseId: id, ...copy(input) });
    },
    async saveTreatment(id, input) {
      await check('VETERINARIAN');
      input.medications?.forEach((item) => required(item.name, 'Medication name'));
      input.groomTasks?.forEach((item) => required(item.instruction, 'Task instruction'));
      if (input.reexaminationDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.reexaminationDate)) throw new Error('Invalid review date');
      writable(id).treatment = { ...copy(input), id: get(id).treatment?.id ?? nextId('TP'), caseId: id };
      // Assignment is deliberately not invented: new plan instructions are not auto-assigned.
    },
    async addReexamination(id, input) {
      await check('VETERINARIAN'); required(input.findings, 'Findings');
      if (!['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'].includes(input.recoveryStatus)) throw new Error('Invalid recovery status');
      writable(id).reexaminations.push({ id: nextId('RE'), caseId: id, ...copy(input) });
    },
    async closeCase(id) { await check('VETERINARIAN'); writable(id).status = 'CLOSED'; },
    async listIncidents() {
      await check('VETERINARIAN');
      return options.empty ? [] : [{ id: 'INC-02', horseId: 'ST-014', description: 'Uneven gait after training', status: 'UNDER_REVIEW' }];
    },
    async listTasks() {
      await check('GROOM');
      return copy(tasks.filter((task) => task.assignedTo === actor.id).map(({ assignedTo: _assignment, ...task }) => { void _assignment; return task; }));
    },
    async completeTask(id, input) {
      await check('GROOM');
      const task = tasks.find((item) => item.id === id && item.assignedTo === actor.id);
      if (!task) throw new Error('Assigned treatment task not found');
      if (task.status === 'COMPLETED') throw new Error('Task already completed');
      task.status = 'COMPLETED'; task.completionNotes = input.completionNotes;
    },
  };
}
