// Regression contract for the delegated CORE-036/046 shared adapter corrections.
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { requestApi } from '../auth/authApi';
import { setBusinessActor } from './businessData';
import { resetSamples, readSamples, sampleUser } from './sampleStore';
import type { Incident, MedicalCase, TreatmentPlan, CaseTreatmentTask, Page } from '../../features/medical/models';

const actor = (role: 'GROOM' | 'VETERINARIAN', id?: number) => setBusinessActor({ ...sampleUser(role), ...(id ? { id } : {}) });
const call = <T,>(path: string, method = 'GET', body?: unknown) => requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function report() {
  actor('GROOM');
  return call<Incident>('/api/incidents', 'POST', { horseId: 7, incidentType: 'FEVER', observedSeverity: 'LOW', observedAt: new Date().toISOString() });
}
beforeEach(() => { localStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); resetSamples(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); })); });
afterEach(() => { setBusinessActor(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('shares Incident → Case → Exam/Injury → Plan → Groom → Recovery/Close in one persisted graph', async () => {
  const incident = await report();
  actor('VETERINARIAN');
  const reviewed = await call<Incident>(`/api/incidents/${incident.id}/review`, 'POST', { action: 'OPEN_CASE' });
  const id = reviewed.medicalCaseId!;
  await call(`/api/medical/cases/${id}/examinations`, 'POST', { symptoms: 'Clinical findings', examinedAt: new Date().toISOString() });
  await call(`/api/medical/cases/${id}/injuries`, 'POST', { bodyRegion: 'Left Forelimb', severity: 'MILD', recoveryStatus: 'NOT_RECOVERED' });
  const plan = await call<TreatmentPlan>(`/api/medical/cases/${id}/treatment-plan`, 'PUT', { treatmentMedicationInstructions: 'Veterinarian-only detail', groomTasks: [{ assignedGroomUserId: 16, instruction: 'Check bedding', taskDate: new Date().toISOString().slice(0, 10) }] });
  actor('GROOM');
  const tasks = await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks');
  const task = tasks.items.find((item) => item.instruction === 'Check bedding')!;
  expect(task).not.toHaveProperty('caseId'); expect(task).not.toHaveProperty('treatmentMedicationInstructions');
  await call(`/api/groom/treatment-tasks/${task.id}/complete`, 'POST', {});
  actor('VETERINARIAN');
  await call(`/api/medical/cases/${id}/re-examinations`, 'POST', { recoveryStatus: 'RECOVERED', findings: 'Normal', examinedAt: new Date().toISOString() });
  await call(`/api/incidents/${incident.id}/review`, 'POST', { action: 'RESOLVE' });
  await call(`/api/medical/cases/${id}/close`, 'POST');
  const restored = readSamples();
  expect(restored.cases.find((item) => item.id === id)).toMatchObject({ horseId: 7, status: 'CLOSED', treatmentPlan: { id: plan.id } });
  expect(restored.tasks.find((item) => item.id === task.id)).toMatchObject({ status: 'COMPLETED', assignedGroomUserId: 16 });
  expect(localStorage.getItem('racehorse.business-samples.v1')).not.toBeNull();
  expect(localStorage.getItem('racehorse.medical-demo.v2')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('does not expose another Groom account’s seeded task', async () => {
  actor('GROOM', 900);
  const tasks = await call<Page<CaseTreatmentTask>>('/api/groom/treatment-tasks');
  expect(tasks.items.every((item) => item.assignedGroomUserId === 900)).toBe(true);
});

it('refuses completion of another Groom account’s seeded task', async () => {
  actor('GROOM', 900);
  await expect(call('/api/groom/treatment-tasks/701/complete', 'POST', {})).rejects.toMatchObject({ status: expect.any(Number) });
});

it('does not expose another Groom reporter’s seeded incident', async () => {
  actor('GROOM', 900);
  const incidents = await call<Page<Incident>>('/api/incidents');
  expect(incidents.items.every((item) => item.reportedByUserId === 900)).toBe(true);
});

it('keeps RESOLVED terminal and refuses opening a case after resolution', async () => {
  const incident = await report(); actor('VETERINARIAN');
  await call(`/api/incidents/${incident.id}/review`, 'POST', { action: 'RESOLVE' });
  await expect(call(`/api/incidents/${incident.id}/review`, 'POST', { action: 'OPEN_CASE' })).rejects.toMatchObject({ status: 409 });
});

it('preserves completed task history when replacing pending assignments', async () => {
  actor('GROOM'); await call('/api/groom/treatment-tasks/701/complete', 'POST', {});
  actor('VETERINARIAN'); await call('/api/medical/cases/501/treatment-plan', 'PUT', { treatmentMedicationInstructions: 'Updated clinical plan', groomTasks: [] });
  expect(readSamples().tasks.find((item) => item.id === 701)).toMatchObject({ status: 'COMPLETED', completedByUserId: 16 });
});

it('rejects closure with unresolved incidents and incomplete treatment', async () => {
  actor('VETERINARIAN');
  await expect(call<MedicalCase>('/api/medical/cases/501/close', 'POST')).rejects.toMatchObject({ status: 409 });
  expect(readSamples().cases.find((item) => item.id === 501)?.status).toBe('OPEN');
});
