import { ApiError, type CurrentUser } from '../shared/auth/authApi';
import { readSamples, saveSamples } from '../shared/data/sampleStore';
import { evaluateActivation } from '../shared/data/horseSamples';

/**
 * UI DEMO ONLY: sample answers for the few operations that the normal sample adapter leaves on the real backend.
 * In demo mode nothing may reach a server, so these are answered locally and clearly as sample data.
 *
 * - GET  /api/auth/me                             → the simulated demo identity (used by the CORE-046 client)
 * - GET  /api/horses/{id}/training-availability   → derived from the sample horse record (no restriction editor in demo)
 * - POST /api/horses/{horseId}/baseline-examinations → shape of the approved Flow 3 contract (CORE-006,
 *   BaselineExaminationRequest/BaselineExamination). Recording the baseline does not itself approve anything; the sample
 *   store then re-evaluates the DEC-009 §1 automatic activation conditions, as CORE-016 will on the backend.
 */
export function handleDemoSample(path: string, init: RequestInit, actor: CurrentUser): { handled: boolean; data?: unknown } {
  const route = new URL(path, 'http://sample.invalid').pathname;
  const method = (init.method ?? 'GET').toUpperCase();

  if (route === '/api/auth/me' && method === 'GET') return { handled: true, data: structuredClone(actor) };

  const availability = route.match(/^\/api\/horses\/(\d+)\/training-availability$/);
  if (availability && method === 'GET') {
    const data = readSamples();
    const horseId = Number(availability[1]);
    const record = data.horseRegistry?.records.find((item) => item.id === horseId);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Horse not found in sample data.');
    // No restriction editor exists yet (CORE-020), so the sample store has no active restriction to report.
    return { handled: true, data: { horseId, availability: record.trainingAvailability ?? 'AVAILABLE' } };
  }

  const baseline = route.match(/^\/api\/horses\/(\d+)\/baseline-examinations$/);
  if (baseline && method === 'POST') {
    if (!actor.roles.includes('VETERINARIAN')) throw new ApiError(403, 'FORBIDDEN', 'Only the Veterinarian records the baseline examination.');
    const body = JSON.parse(String(init.body ?? '{}')) as { weightKg?: number; healthStatus?: string; clinicalNotes?: string };
    if (!(typeof body.weightKg === 'number' && body.weightKg > 0 && body.weightKg <= 9999.99) || !['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'].includes(body.healthStatus ?? '')) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a weight in kilograms and a health status.');
    }
    const data = readSamples();
    const registry = data.horseRegistry;
    const horseId = Number(baseline[1]);
    const record = registry?.records.find((item) => item.id === horseId);
    if (!registry || !record) throw new ApiError(404, 'NOT_FOUND', 'Horse not found in sample data.');
    if (registry.baselineHorseIds.includes(horseId)) throw new ApiError(409, 'CONFLICT', 'A baseline examination is already recorded for this horse.');
    registry.baselineHorseIds.push(horseId);
    record.healthStatus = body.healthStatus as typeof record.healthStatus;
    evaluateActivation(record, registry);
    const result = { id: data.nextId++, horseId, weightKg: body.weightKg, healthStatus: body.healthStatus, recordedAt: new Date().toISOString() };
    saveSamples(data);
    return { handled: true, data: result };
  }

  return { handled: false };
}
