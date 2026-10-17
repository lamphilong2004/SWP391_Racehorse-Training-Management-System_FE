import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { Core046Client } from './client';
import { IncidentDetailPage, IncidentsPage, TreatmentTasksPage } from './pages';
import { SessionContext, type Core046Session } from './session';
import type { GroomTreatmentTask, Incident, Page } from './contract';

function day() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const task = (status: 'PENDING' | 'COMPLETED' = 'PENDING'): GroomTreatmentTask => ({ id: 7, horseId: 3, assignedGroomUserId: 5, instruction: 'Check bedding', taskDate: day(), status });
const page = (items: GroomTreatmentTask[]): Page<GroomTreatmentTask> => ({ items, page: 0, size: 100, totalElements: items.length });
function session(id = 5): Core046Session { return { client: new Core046Client('test-only'), user: { id, fullName: `Groom ${id}`, role: 'GROOM' } }; }
afterEach(() => vi.restoreAllMocks());

it('keeps tasks completed today visible in Today and Completed', async () => {
  const value = session();
  vi.spyOn(value.client, 'listTreatmentTasks').mockResolvedValue(page([task('COMPLETED')]));
  render(<SessionContext.Provider value={value}><MemoryRouter><TreatmentTasksPage /></MemoryRouter></SessionContext.Provider>);
  expect(await screen.findByText('Check bedding')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Today · 1' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Completed · 1' }));
  expect(screen.getByText('Check bedding')).toBeInTheDocument();
});

it('loads a newly assigned task through Refresh without losing the current task filter', async () => {
  const value = session();
  const list = vi.spyOn(value.client, 'listTreatmentTasks').mockResolvedValueOnce(page([])).mockResolvedValue(page([task()]));
  render(<SessionContext.Provider value={value}><MemoryRouter><TreatmentTasksPage /></MemoryRouter></SessionContext.Provider>);
  await screen.findByText('No treatment tasks');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh tasks' }));
  expect(await screen.findByText('Check bedding')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Today · 1' })).toHaveAttribute('aria-selected', 'true');
  expect(list).toHaveBeenCalledTimes(2);
});

it('retains a server-confirmed completion when readback fails and refreshes without posting again', async () => {
  const value = session();
  const list = vi.spyOn(value.client, 'listTreatmentTasks').mockResolvedValueOnce(page([task()])).mockRejectedValueOnce(new Error('Readback offline')).mockResolvedValue(page([task('COMPLETED')]));
  const complete = vi.spyOn(value.client, 'completeTreatmentTask').mockResolvedValue({ ...task('COMPLETED'), completedAt: '2026-10-18T01:00:00Z' });
  render(<SessionContext.Provider value={value}><MemoryRouter><TreatmentTasksPage /></MemoryRouter></SessionContext.Provider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }));
  expect(await screen.findByText('Task completed, but the list could not be refreshed')).toBeInTheDocument();
  expect(screen.getByText('Readback offline')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh tasks' }));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  expect(await screen.findByText('Check bedding')).toBeInTheDocument();
  expect(complete).toHaveBeenCalledOnce();
});

it('does not treat an invalid completion response as confirmed or fabricate completion metadata', async () => {
  const value = session();
  vi.spyOn(value.client, 'listTreatmentTasks').mockResolvedValue(page([task()]));
  vi.spyOn(value.client, 'completeTreatmentTask').mockResolvedValue({ ...task(), id: 99 });
  render(<SessionContext.Provider value={value}><MemoryRouter><TreatmentTasksPage /></MemoryRouter></SessionContext.Provider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }));
  expect(await screen.findByText('The server did not confirm this task completion. Refresh before retrying.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
  expect(screen.queryByText('Task 7 completed.')).not.toBeInTheDocument();
});

it('clears a previous Groom task immediately while a different actor loads', async () => {
  const first = session(); const second = session(6);
  vi.spyOn(first.client, 'listTreatmentTasks').mockResolvedValue(page([task()]));
  let finish!: (value: Page<GroomTreatmentTask>) => void;
  vi.spyOn(second.client, 'listTreatmentTasks').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = (value: Core046Session) => <SessionContext.Provider value={value}><MemoryRouter><TreatmentTasksPage /></MemoryRouter></SessionContext.Provider>;
  const rendered = render(view(first));
  await screen.findByText('Check bedding');
  rendered.rerender(view(second));
  expect(screen.queryByText('Check bedding')).not.toBeInTheDocument();
  expect(screen.getByText('Loading assigned tasks…')).toBeInTheDocument();
  await act(async () => finish(page([])));
  expect(await screen.findByText('No treatment tasks')).toBeInTheDocument();
});

it('does not display the previous Incident while another incident detail loads', async () => {
  const value = session();
  let finish!: (value: Incident) => void;
  const incident: Incident = { id: 1, incidentCode: 'INC-001', horseId: 3, reportedByUserId: 5, incidentType: 'FEVER', observedSeverity: 'LOW', observedAt: '2026-10-18T01:00:00Z', reportedAt: '2026-10-18T01:00:00Z', status: 'REPORTED', description: 'First report' };
  vi.spyOn(value.client, 'getIncident').mockResolvedValueOnce(incident).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const router = createMemoryRouter([{ path: '/incidents/:incidentId', element: <IncidentDetailPage /> }], { initialEntries: ['/incidents/1'] });
  render(<SessionContext.Provider value={value}><RouterProvider router={router} /></SessionContext.Provider>);
  await screen.findByText('First report');
  await act(() => router.navigate('/incidents/2'));
  expect(screen.queryByText('First report')).not.toBeInTheDocument();
  await act(async () => finish({ ...incident, id: 2, incidentCode: 'INC-002', description: 'Second report' }));
  expect(await screen.findByText('Second report')).toBeInTheDocument();
});

it('clears the previous reporter list immediately when the signed-in Groom changes', async () => {
  const first = session(); const second = session(6);
  const now = new Date().toISOString();
  const incident: Incident = { id: 1, incidentCode: 'INC-PRIVATE', horseId: 3, reportedByUserId: 5, incidentType: 'FEVER', observedSeverity: 'LOW', observedAt: now, reportedAt: now, status: 'REPORTED' };
  vi.spyOn(first.client, 'listIncidents').mockResolvedValue({ items: [incident], page: 0, size: 100, totalElements: 1 });
  let finish!: (value: Page<Incident>) => void;
  vi.spyOn(second.client, 'listIncidents').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = (value: Core046Session) => <SessionContext.Provider value={value}><MemoryRouter><IncidentsPage /></MemoryRouter></SessionContext.Provider>;
  const rendered = render(view(first));
  await screen.findByText('INC-PRIVATE');
  rendered.rerender(view(second));
  expect(screen.queryByText('INC-PRIVATE')).not.toBeInTheDocument();
  expect(screen.getByText('Loading incidents…')).toBeInTheDocument();
  await act(async () => finish({ items: [], page: 0, size: 100, totalElements: 0 }));
  expect(await screen.findByText('No incidents')).toBeInTheDocument();
});
