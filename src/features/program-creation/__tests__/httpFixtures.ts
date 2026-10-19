/** Test-only HTTP data. The application never imports this module or falls back to fixtures. */
import type { CurrentUser } from '../../../shared/auth/authApi';
import type { HorseSelection } from '../programTypes';
import { candidate, createdProgram, template } from './fixtures';

export const headTrainer: CurrentUser = { id: 11, userCode: 'HT-011', fullName: 'Fixture Head Trainer', email: 'head@example.test', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' };
export const horses: HorseSelection[] = [
  { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt', breed: 'Thoroughbred', sex: 'MALE', foaledDate: '2022-01-10', lifecycle: 'ACTIVE', trainingAvailability: 'AVAILABLE' },
  { id: 8, horseCode: 'ST-002', name: 'Silver Star', lifecycle: 'ACTIVE', trainingAvailability: 'LIMITED' },
  { id: 9, horseCode: 'LK-003', name: 'Locked Horse', lifecycle: 'ACTIVE', trainingAvailability: 'LOCKED' },
];
export function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
}
export function failure(status: number, code: string, message: string, details: { field?: string; message: string }[] = []) {
  return new Response(JSON.stringify({ success: false, error: { code, message, details } }), { status, headers: { 'Content-Type': 'application/json' } });
}
const page = (items: unknown[]) => ({ page: 0, size: 20, totalItems: items.length, totalPages: 1, items });

export function fixtureResponse(url: URL, init?: RequestInit, user = headTrainer): Response {
  const path = url.pathname;
  if (path === '/api/auth/me') return ok(user);
  if (path === '/api/horses') return ok(page(horses));
  if (path.endsWith('/template-recommendations')) return ok([{ templateId: 3, templateCode: 'TPL-003', templateVersionId: 302, versionNo: 2, name: template.version.name, label: 'RECOMMENDED', reasons: ['Matches endurance goals'] }]);
  if (path === '/api/program-templates') return ok(page([template.template, { ...template.template, id: 4, name: 'Recovery', templateCode: 'TPL-004' }]));
  if (/\/api\/program-templates\/\d+$/.test(path)) {
    const id = Number(path.split('/').pop());
    const versionNo = Number(url.searchParams.get('versionNo') ?? 3);
    return ok({ ...structuredClone(template), template: { ...template.template, id }, version: { ...structuredClone(template.version), id: id * 100 + versionNo, versionNo,
      phases: template.version.phases.map((phase) => ({ ...phase, id: versionNo === 2 && id === 3 ? phase.id : phase.id + 10 })) } });
  }
  if (path.endsWith('/trainer-recommendations')) return ok({ candidates: [candidate] });
  if (path === '/api/training-programs' && init?.method === 'POST') return ok(createdProgram, 201);
  if (path === '/api/training-programs/1001') return ok({ ...createdProgram, name: 'Saved server program' });
  throw new Error(`Unhandled fixture: ${init?.method ?? 'GET'} ${url.href}`);
}
