import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAuthApi, requestApi, type CurrentUser } from '../shared/auth/authApi';
import { createMedicalService } from '../features/medical/service';
import { Core046Client } from '../features/core046/client';
import { createMedicalDemoFetch, resetMedicalDemo } from './medicalDemo';
import { createMedicalTransport, medicalDataSource } from '../shared/services/medicalTransport';

// Public actor fixtures model /me; this suite never implements a second login system.
const vet: CurrentUser = { id: 71, userCode: 'V-71', email: 'vet@example.test', fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' };
const groom: CurrentUser = { ...vet, id: 82, roles: ['GROOM'] };
const secondGroom: CurrentUser = { ...groom, id: 83 };
const clinical = () => createMedicalService('fixture-session', undefined, { actor: vet });
const care = () => new Core046Client('fixture-session', undefined, undefined, groom);

beforeEach(() => {
  vi.stubEnv('VITE_MEDICAL_DATA_SOURCE', 'demo');
  vi.stubEnv('VITE_DEMO_DELAY_MS', '0');
  vi.stubEnv('VITE_DEMO_GROOM_USER_ID', String(groom.id));
  resetMedicalDemo();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network call'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('shares a persisted Incident → Case → treatment → Groom → recovery flow using real actor IDs', async () => {
  const reporter = care(), clinician = clinical();
  const incident = await reporter.reportIncident({ horseId: 102, incidentType: 'OFF_FEED', observedSeverity: 'LOW', observedAt: new Date().toISOString(), description: 'Reduced appetite' });
  const caseId = (await clinician.reviewIncident(incident.id, 'OPEN_CASE')).medicalCaseId!;
  await clinician.addExamination(caseId, { symptoms: 'Reduced appetite', examinedAt: new Date().toISOString() });
  await clinician.addInjury(caseId, { bodyRegion: 'HEAD', severity: 'MILD', recoveryStatus: 'NOT_RECOVERED' });
  await clinician.saveTreatment(caseId, { treatmentMedicationInstructions: 'Clinical-only instructions', groomTasks: [{ assignedGroomUserId: groom.id, instruction: 'Observe feed intake', taskDate: '2026-01-01' }] });
  const task = (await reporter.listTreatmentTasks()).items.find((entry) => entry.instruction === 'Observe feed intake')!;
  expect(task.assignedGroomUserId).toBe(groom.id);
  expect(task).not.toHaveProperty('caseId');
  expect(task).not.toHaveProperty('treatmentMedicationInstructions');
  await reporter.completeTreatmentTask(task.id);
  await clinician.addReexamination(caseId, { recoveryStatus: 'RECOVERED', findings: 'Appetite normal', examinedAt: new Date().toISOString() });
  await clinician.reviewIncident(incident.id, 'RESOLVE');
  expect((await clinician.closeCase(caseId)).status).toBe('CLOSED');
  expect((await clinical().getCase(caseId)).reexaminations[0].findings).toBe('Appetite normal');
  expect((await care().listTreatmentTasks()).items.find((entry) => entry.id === task.id)?.status).toBe('COMPLETED');
  expect(fetch).not.toHaveBeenCalled();
});

it('binds initial sample assignments once to the first authenticated Groom when no ID is configured', async () => {
  vi.stubEnv('VITE_DEMO_GROOM_USER_ID', ''); resetMedicalDemo();
  expect((await care().listTreatmentTasks()).items.every((entry) => entry.assignedGroomUserId === groom.id)).toBe(true);
  const other = new Core046Client('fixture-session', undefined, undefined, secondGroom);
  expect((await other.listTreatmentTasks()).items).toEqual([]);
});

it('enforces demo role and row scope and rejects repeated completion', async () => {
  const reporter = care();
  expect((await reporter.listIncidents()).items.every((entry) => entry.reportedByUserId === groom.id)).toBe(true);
  await expect(reporter.completeTreatmentTask(43)).rejects.toMatchObject({ status: 404 });
  await expect(reporter.getIncident(23)).rejects.toMatchObject({ status: 404 });
  await reporter.completeTreatmentTask(41);
  await expect(reporter.completeTreatmentTask(41)).rejects.toMatchObject({ status: 409 });
  await expect(createMedicalService('fixture-session', undefined, { actor: groom }).getCase(1)).rejects.toMatchObject({ status: 403 });
});

it('preserves the current incident on a conflicting link and does not auto-lift restrictions', async () => {
  const clinician = clinical();
  await expect(clinician.reviewIncident(22, 'LINK_CASE', 1)).rejects.toMatchObject({ status: 409 });
  expect((await clinician.getIncident(22)).status).toBe('REPORTED');
  await clinician.addReexamination(1, { recoveryStatus: 'RECOVERED', findings: 'Improved', examinedAt: new Date().toISOString() });
  expect((await clinician.getAvailability(101)).availability).toBe('LIMITED');
  await expect(clinician.closeCase(1)).rejects.toMatchObject({ status: 409 });
});

it('keeps completed task history when replacing pending assignments', async () => {
  await care().completeTreatmentTask(41);
  await clinical().saveTreatment(1, { treatmentMedicationInstructions: 'Updated plan', groomTasks: [{ assignedGroomUserId: groom.id, instruction: 'Revised care task', taskDate: '2026-01-01' }] });
  const rows = (await clinical().listCaseTasks(1)).items;
  expect(rows.some((entry) => entry.id === 41 && entry.status === 'COMPLETED')).toBe(true);
  expect(rows.filter((entry) => entry.status === 'PENDING').map((entry) => entry.instruction)).toEqual(['Revised care task']);
});

it('always sends shared auth to the configured backend even when medical data is demo', async () => {
  const network = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: vet }), { status: 200 }));
  vi.stubGlobal('fetch', network);
  expect((await createAuthApi().currentUser('fixture-session', vi.fn())).id).toBe(vet.id);
  expect(String(network.mock.calls[0][0])).toContain('/api/auth/me');
  expect(new Headers(network.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer fixture-session');
});

it('does not fall back to demo when real login or medical APIs fail', async () => {
  const network = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied', details: [] } }), { status: 403 }));
  vi.stubGlobal('fetch', network);
  await expect(createAuthApi().currentUser('fixture-session', vi.fn())).rejects.toMatchObject({ status: 403 });
  vi.stubEnv('VITE_MEDICAL_DATA_SOURCE', 'api');
  network.mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'CONFLICT', message: 'Not ready', details: [] } }), { status: 409 }));
  await expect(clinical().createCase({ horseId: 105, reason: 'Observation' })).rejects.toMatchObject({ status: 409 });
  expect(network).toHaveBeenCalledTimes(2);
});

it('refuses missing/inactive actors and never exposes an auth endpoint or stores a JWT', async () => {
  await expect(requestApi('/api/medical/cases', {}, { fetcher: createMedicalTransport() })).rejects.toMatchObject({ status: 401 });
  const adapter = createMedicalDemoFetch(vet);
  expect((await adapter('/api/auth/login', { method: 'POST' })).status).toBe(404);
  const inactive = createMedicalDemoFetch({ ...groom, accountStatus: 'INACTIVE' });
  expect((await inactive('/api/groom/treatment-tasks')).status).toBe(403);
  const saved = localStorage.getItem('racehorse.medical-demo.v2') ?? '';
  expect(saved).not.toContain('fixture-session');
  expect(saved).not.toContain('sessions');
});

it('handles missing records, pagination and resetting only business demo data', async () => {
  const clinician = clinical();
  expect((await clinician.listCases(1)).items).toEqual([]);
  await expect(clinician.getCase(999)).rejects.toMatchObject({ status: 404 });
  await clinician.createCase({ horseId: 105, reason: 'Observation' });
  resetMedicalDemo();
  expect((await clinician.listCases()).totalElements).toBe(2);
});

it('rejects unsupported configuration rather than silently selecting another source', () => {
  vi.stubEnv('VITE_MEDICAL_DATA_SOURCE', 'automatic');
  expect(medicalDataSource).toThrow('must be api or demo');
});
