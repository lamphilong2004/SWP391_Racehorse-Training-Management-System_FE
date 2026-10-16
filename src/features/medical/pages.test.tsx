import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MedicalAccess, MedicalProvider } from './runtime';
import { CaseListPage, IncidentListPage } from './pages';
import type { MedicalRuntime } from './runtimeContext';

it('blocks a non-Veterinarian before medical data is requested', () => {
  const listCases = vi.fn();
  const value = { actor: { id: 6, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' }, service: { listCases } } as unknown as MedicalRuntime;
  render(<MemoryRouter><MedicalProvider value={value}><MedicalAccess><div>Clinical data</div></MedicalAccess></MedicalProvider></MemoryRouter>);
  expect(screen.getByText('Access denied')).toBeInTheDocument();
  expect(screen.queryByText('Clinical data')).not.toBeInTheDocument();
  expect(listCases).not.toHaveBeenCalled();
});

it('loads Vet case list through the service boundary', async () => {
  const listCases = vi.fn().mockResolvedValue({ items: [{ id: 9, horseId: 14, status: 'OPEN', openedAt: '2026-10-16T01:00:00Z', reason: 'Lameness' }], page: 0, size: 20, totalElements: 1 });
  const value = { actor: { id: 7, fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' }, service: { listCases } } as unknown as MedicalRuntime;
  render(<MemoryRouter><MedicalProvider value={value}><MedicalAccess><CaseListPage /></MedicalAccess></MedicalProvider></MemoryRouter>);
  expect(await screen.findByText('Lameness')).toBeInTheDocument();
  expect(listCases).toHaveBeenCalledWith(0);
});

it('loads Vet incident review list without a Groom report action', async () => {
  const listIncidents = vi.fn().mockResolvedValue({ items: [{ id: 21, incidentCode: 'INC-021', horseId: 14, reportedByUserId: 6, incidentType: 'FEVER', observedSeverity: 'HIGH', reportedAt: '2026-10-16T01:00:00Z', status: 'REPORTED' }], page: 0, size: 20, totalElements: 1 });
  const value = { actor: { id: 7, fullName: 'Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' }, service: { listIncidents } } as unknown as MedicalRuntime;
  render(<MemoryRouter><MedicalProvider value={value}><MedicalAccess><IncidentListPage /></MedicalAccess></MedicalProvider></MemoryRouter>);
  expect(await screen.findByText('INC-021')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Report Incident' })).not.toBeInTheDocument();
});
