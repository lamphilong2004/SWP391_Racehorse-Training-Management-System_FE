import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestApi } from '../auth/authApi';
import { setBusinessActor } from './businessData';
import { readSamples, saveSamples, sampleUser } from './sampleStore';
import type { Incident, CaseTreatmentTask, MedicalCase, Page } from '../../features/medical/models';

// Exercise existing presentation routing; product auth and transport are not replaced.
vi.mock('../../demo/demoMode', () => ({ DEMO_UI_ONLY: true, PRESENTATION_MODE: true, SHOW_DEV_BAR: false }));
const actor = (role: 'GROOM' | 'VETERINARIAN', id = sampleUser(role).id) => setBusinessActor({ ...sampleUser(role), id });
const call = <T,>(path: string, method = 'GET', body?: unknown) => requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => { localStorage.clear(); setBusinessActor(null); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Sample identity must not reach the network'); })); });
afterEach(() => { setBusinessActor(null); vi.unstubAllGlobals(); });

it('initializes Horse registry when Medical is opened first and answers availability without visiting Horse', async () => {
  actor('VETERINARIAN');
  const cases = await call<Page<MedicalCase>>('/api/medical/cases');
  expect(cases.items[0].horseId).toBe(7);
  await expect(call('/api/horses/7/training-availability')).resolves.toMatchObject({ horseId: 7, availability: 'AVAILABLE' });
  expect(readSamples().horseRegistry?.records[0]).toMatchObject({ id: 7, healthStatus: 'MONITORING' });
  expect(fetch).not.toHaveBeenCalled();
});

it('backfills only a missing registry while preserving valid legacy medical, session and ID data', async () => {
  const data = readSamples(); delete data.horseRegistry;
  data.nextId = 9000; data.healthStatus = 'INJURED'; data.cases[0].reason = 'Persisted clinical record';
  data.tasks[0].status = 'COMPLETED'; data.tasks[0].completedByUserId = 16;
  const preserved = structuredClone({ cases: data.cases, tasks: data.tasks, incidents: data.incidents, sessions: data.sessions, programs: data.programs });
  saveSamples(data); actor('VETERINARIAN');
  await call('/api/medical/cases'); await call('/api/horses/7/training-availability');
  const restored = readSamples();
  expect(restored).toMatchObject({ ...preserved, nextId: 9000, healthStatus: 'INJURED' });
  expect(restored.horseRegistry?.records[0].healthStatus).toBe('INJURED');
});

it('does not replace an existing registry, photos or saved horse identity during Medical initialization', async () => {
  const data = readSamples(); const registry = data.horseRegistry!;
  registry.records[0].name = 'Saved horse name'; registry.photos[7] = [{ id: 800, url: 'data:image/png;base64,sample', uploadedAt: '2026-10-01T00:00:00Z' }];
  const preserved = structuredClone(registry); saveSamples(data);
  actor('VETERINARIAN'); await call('/api/medical/cases');
  expect(readSamples().horseRegistry).toEqual(preserved);
});

it('keeps original seed ownership when different Groom accounts log in', async () => {
  actor('GROOM', 900); expect((await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks')).items).toEqual([]);
  setBusinessActor(null); actor('GROOM', 901);
  expect((await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks')).items).toEqual([]);
  actor('GROOM');
  expect((await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks')).items).toEqual([expect.objectContaining({ id: 701, assignedGroomUserId: sampleUser('GROOM').id })]);
});

it('assigns a known non-default Groom and keeps assignment across logout, restore and readback', async () => {
  actor('GROOM', 900); await call('/api/groom/treatment-tasks');
  actor('VETERINARIAN');
  await call('/api/medical/cases/501/treatment-plan', 'PUT', { treatmentMedicationInstructions: 'Private clinical detail', groomTasks: [{ assignedGroomUserId: 900, instruction: 'Observe bedding', taskDate: '2026-10-17' }] });
  setBusinessActor(null); await expect(call('/api/groom/treatment-tasks')).rejects.toMatchObject({ status: 401 });
  actor('GROOM'); expect((await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks')).items).toEqual([]);
  actor('GROOM', 900); const tasks = await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks');
  expect(tasks.items).toHaveLength(1); expect(tasks.items[0]).not.toHaveProperty('treatmentMedicationInstructions'); expect(tasks.items[0]).not.toHaveProperty('caseId');
  await call(`/api/groom/treatment-tasks/${tasks.items[0].id}/complete`, 'POST', {});
  setBusinessActor(null); actor('GROOM', 900);
  expect((await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks')).items[0]).toMatchObject({ status: 'COMPLETED', assignedGroomUserId: 900 });
  expect(readSamples().tasks.find((item) => item.id === tasks.items[0].id)).toMatchObject({ completedByUserId: 900 });
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects an unrecognized Groom assignment without changing the saved plan or task history', async () => {
  actor('VETERINARIAN'); const preserved = readSamples();
  await expect(call('/api/medical/cases/501/treatment-plan', 'PUT', { treatmentMedicationInstructions: 'Changed', groomTasks: [{ assignedGroomUserId: 999, instruction: 'Observe', taskDate: '2026-10-17' }] })).rejects.toMatchObject({ status: 400 });
  expect(readSamples()).toEqual(preserved);
});

it('denies a foreign Incident detail but permits the current Groom’s explicit report', async () => {
  actor('GROOM', 900);
  await expect(call('/api/incidents/601')).rejects.toMatchObject({ status: 403 });
  const incident = await call<Incident>('/api/incidents', 'POST', { horseId: 7, incidentType: 'FEVER', observedSeverity: 'LOW', observedAt: new Date().toISOString() });
  setBusinessActor(null); actor('GROOM', 900);
  await expect(call(`/api/incidents/${incident.id}`)).resolves.toMatchObject({ reportedByUserId: 900 });
  expect(readSamples().incidents.find((item) => item.id === 601)?.reportedByUserId).toBe(sampleUser('GROOM').id);
});

it.each(['OPEN_CASE', 'LINK_CASE', 'RESOLVE'])('rejects %s on a resolved Incident without changing persisted data', async (action) => {
  actor('GROOM'); const incident = await call<Incident>('/api/incidents', 'POST', { horseId: 7, incidentType: 'FEVER', observedSeverity: 'LOW', observedAt: new Date().toISOString() });
  actor('VETERINARIAN'); await call(`/api/incidents/${incident.id}/review`, 'POST', { action: 'RESOLVE' });
  const preserved = readSamples();
  await expect(call(`/api/incidents/${incident.id}/review`, 'POST', { action, ...(action === 'LINK_CASE' ? { medicalCaseId: 501 } : {}) })).rejects.toMatchObject({ status: 409 });
  expect(readSamples()).toEqual(preserved);
});

it('retains Veterinarian read permission for a legitimately multi-role actor', async () => {
  setBusinessActor({ ...sampleUser('VETERINARIAN'), roles: ['GROOM', 'VETERINARIAN'] });
  await expect(call('/api/incidents/601')).resolves.toMatchObject({ id: 601 });
});
