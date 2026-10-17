import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { requestApi, type CurrentUser } from '../auth/authApi';
import { setBusinessActor, usesSampleData } from './businessData';
import { readSamples, resetSamples, saveSamples, sampleUser } from './sampleStore';
import { CHECK_ITEMS, type Checklist } from '../../features/precheck/types';
import type { SessionResultView } from '../../features/evaluation/models';

const checks = (abnormal = false) => Object.fromEntries(CHECK_ITEMS.map(({ key }, index) => [key, { result: abnormal && index === 0 ? 'ABNORMAL' : 'NORMAL', observation: '' }])) as Checklist;
const actor = (role: CurrentUser['roles'][number]) => setBusinessActor({ ...sampleUser(role), id: 900 });
const post = <T,>(id: number, action: string, body?: unknown) => requestApi<T>(`/api/training-sessions/${id}/${action}`, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => { localStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); resetSamples(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); })); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setBusinessActor(null); });

it('shares a normal Groom check with Rider start, complete, feedback and Trainer evaluation, without API mutations', async () => {
  actor('WORK_RIDER'); await expect(post(44, 'start')).rejects.toMatchObject({ status: 409 });
  actor('GROOM'); await post(44, 'pre-session-check', { checks: checks() });
  expect(readSamples().sessions.find((item) => item.session.id === 44)?.session.status).toBe('SCHEDULED');
  actor('WORK_RIDER'); await post(44, 'start'); await post(44, 'complete');
  await post(44, 'rider-feedback', { responses: { horseResponse: 'Settled', breathing: null, notes: 'Observed only' } });
  await expect(post(44, 'rider-feedback', { responses: {} })).rejects.toMatchObject({ status: 409 });
  actor('TRAINER'); await post(44, 'evaluation', { result: 'MET', recommendation: 'Review next session' });
  const result = await requestApi<SessionResultView>('/api/training-sessions/44/result');
  expect(result.session.status).toBe('COMPLETED'); expect(result.evaluation?.result).toBe('MET'); expect(result.riderFeedback?.responses.breathing).toBeNull();
  expect(result.actual.totalDistanceM).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it('records abnormal observations without an automatic incident and rejects a blocked start', async () => {
  actor('GROOM'); const count = readSamples().incidents.length;
  await post(45, 'pre-session-check', { checks: checks(true) });
  expect(readSamples().incidents).toHaveLength(count);
  actor('WORK_RIDER'); await expect(post(45, 'start')).rejects.toMatchObject({ status: 409 });
  expect(readSamples().sessions.find((item) => item.session.id === 45)?.session.status).toBe('SCHEDULED');
});
it('keeps early start and inactive program blocked even after a normal check', async () => {
  actor('GROOM'); await post(48, 'pre-session-check', { checks: checks() });
  actor('WORK_RIDER'); await expect(post(48, 'start')).rejects.toMatchObject({ status: 409 });
  actor('GROOM'); await post(44, 'pre-session-check', { checks: checks() });
  const data = readSamples(); data.programs[0].status = 'COMPLETED'; saveSamples(data);
  actor('WORK_RIDER'); await expect(post(44, 'start')).rejects.toMatchObject({ status: 409 });
});
it('allows issue reporting while paused, links the incident and never completes an interrupted session', async () => {
  actor('WORK_RIDER'); await expect(post(46, 'complete')).rejects.toMatchObject({ status: 409 });
  const incident = await post<{ incidentId: number; sessionStatus: string }>(46, 'report-issue', { incidentType: 'OTHER', observedSeverity: 'LOW', description: 'Horse response changed' });
  expect(incident.sessionStatus).toBe('INTERRUPTED');
  expect(readSamples().incidents.find((item) => item.id === incident.incidentId)?.trainingSessionId).toBe(46);
  await expect(post(46, 'complete')).rejects.toMatchObject({ status: 409 });
  await post(46, 'rider-feedback', { responses: { preInterruptionDescription: 'Stopped for review' } });
  actor('TRAINER'); await post(46, 'evaluation', { result: 'NOT_MET' });
  expect(readSamples().sessions.find((item) => item.session.id === 46)?.session.status).toBe('INTERRUPTED');
});
it('records manual zero values without inventing missing metrics or aggregates, and denies other roles', async () => {
  actor('WORK_RIDER'); await post(47, 'metrics', { recordedAt: new Date().toISOString(), speedKmh: 0, heartRate: null, distanceM: null });
  const result = readSamples().sessions.find((item) => item.session.id === 47)!;
  expect(result.samples?.[0]).toMatchObject({ speedKmh: 0, heartRate: null, distanceM: null });
  expect(result.actual.totalDistanceM).toBeNull(); expect(result.actual.avgSpeedKmh).toBeNull();
  await expect(post(47, 'metrics', { recordedAt: new Date().toISOString(), heartRate: 2.5 })).rejects.toMatchObject({ status: 400 });
  actor('GROOM'); await expect(post(47, 'complete')).rejects.toMatchObject({ status: 403 });
});
it('keeps implemented auth, restriction and availability endpoints on the real transport in mixed mode', () => {
  for (const path of ['/api/auth/login', '/api/auth/me', '/api/auth/logout', '/api/health', '/api/medical/restrictions', '/api/horses/7/training-availability', '/api/horses/7/medical-restrictions', '/api/horses/availability/batch']) expect(usesSampleData(path)).toBe(false);
  expect(usesSampleData('/api/training-sessions/44/start')).toBe(true);
});
