import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HerdHealthPage } from './pages';
import { GroomTasks } from './GroomTasks';
import { MedicalProvider } from './runtime';
import { createMedicalService } from './service';
import { createGroomService } from './groomService';

const horse = { id: 14, horseCode: 'ST-014', name: 'Storm', lifecycle: 'ACTIVE', healthStatus: 'MONITORING', trainingAvailability: 'LIMITED', currentBoxCode: 'B-03' };
const record = { id: 9, horseId: 14, status: 'OPEN', openedAt: '2026-10-19T00:00:00Z', reason: 'Lameness', incidentIds: [], examinations: [], injuries: [], reexaminations: [], treatmentPlan: { id: 3, caseId: 9, createdAt: '2026-10-19T00:00:00Z', treatmentMedicationInstructions: 'Private', reexaminationDate: '2026-10-27' } };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
it('uses approved case IDs, reason and plan review date on the matching horse overview', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (path.includes('/api/horses?')) return ok({ items: [horse], page: 0, size: 100, totalItems: 1, totalPages: 1 });
    if (path.includes('/medical/cases?')) return ok({ items: [record], page: 0, size: 20, totalElements: 1 });
    return ok({ totalHorses: 1, fit: 0, monitoring: 1, injured: 0, quarantined: 0, unassessed: 0 });
  });
  render(<MemoryRouter><MedicalProvider value={{ actor: { id: 7, fullName: 'Vet', userCode: 'V7', email: 'vet@example.test', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' }, service: createMedicalService('session', undefined, { baseUrl: '', fetcher }) }}><HerdHealthPage /></MedicalProvider></MemoryRouter>);
  expect(await screen.findByText('Ca đang mở · Lameness')).toBeInTheDocument();
  expect(screen.getByText('Tái khám 2026-10-27')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở ca →' })).toHaveAttribute('href', '/medical/cases/9');
});
it('enriches Groom groups using only horse IDs returned by the authorized task endpoint', async () => {
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).includes('/api/groom/treatment-tasks?') ?
    ok({ items: [{ id: 1, horseId: 14, assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: today, status: 'PENDING' }], page: 0, size: 100, totalElements: 1 }) : ok(horse));
  render(<GroomTasks service={createGroomService('session', 6, undefined, { baseUrl: '', fetcher })} />);
  expect(await screen.findByRole('heading', { name: 'Storm · ST-014 · Chuồng B-03' })).toBeInTheDocument();
  expect(screen.getByText('Theo dõi')).toBeInTheDocument();
  expect(screen.getByText('Hạn chế')).toBeInTheDocument();
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/groom/treatment-tasks?page=0&size=100', '/api/horses/14']);
});
