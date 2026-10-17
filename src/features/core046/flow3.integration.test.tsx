// CORE-046 handoff fixture. Run against official integration with its canonical shared adapter.
// Production auth/router/store files are imported unchanged. Only the AuthApi boundary is a test fixture.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { ROUTES } from '../../app/routePaths';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { AuthApi, CurrentUser } from '../../shared/auth/authApi';
import { requestApi } from '../../shared/auth/authApi';
import { setBusinessActor } from '../../shared/data/businessData';
import { readSamples, sampleUser } from '../../shared/data/sampleStore';

// Test-only all-routes sample fixture: no backend exists here, so every API call stays in the sample store.
vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample');
vi.stubEnv('VITE_SAMPLE_SCOPE', 'all');
const vet = sampleUser('VETERINARIAN');
const groom = sampleUser('GROOM');
const foreign: CurrentUser = { ...groom, id: 900, userCode: 'TEST-900', email: 'other.groom@example.test', fullName: 'Other Groom fixture' };
const actors = [vet, groom, foreign];
const tokenFor = (user: CurrentUser) => `fixture-only-${user.id}`;
const api: AuthApi = {
  login: vi.fn(async ({ email, password }) => {
    const user = actors.find((actor) => actor.email === email);
    if (!user || password !== 'FixtureOnly123') throw new Error('Invalid fixture credentials');
    return { accessToken: tokenFor(user), tokenType: 'Bearer' as const, expiresIn: 3600, user };
  }),
  currentUser: vi.fn(async (token) => {
    const user = actors.find((actor) => tokenFor(actor) === token);
    if (!user) throw new Error('Unknown fixture session');
    return user;
  }),
  logout: vi.fn(async () => undefined),
};
function mount(path: string) {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  const view = render(<AuthProvider api={api}><RouterProvider router={router} /></AuthProvider>);
  return { ...view, router };
}
async function login(user: CurrentUser) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'FixtureOnly123' } });
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument());
}
async function logout(router: ReturnType<typeof createMemoryRouter>) {
  await act(() => router.navigate('/account'));
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Sign In' });
}
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setBusinessActor(null); vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Sample business requests must not reach the backend'); })); });
afterEach(() => { setBusinessActor(null); authSession.clear(); vi.unstubAllGlobals(); });

// Two-actor journey with four sign-ins and a remount: ~5.2–5.6 s locally, so it gets an explicit limit instead of the 5 s default.
it('persists Vet case/exam/injury/assignment → Groom completion → Vet progress/recovery/close across logins and remount', { timeout: 15_000 }, async () => {
  let view = mount(ROUTES.medicalCaseNew);
  await login(vet);
  const horseId = readSamples().horseRegistry!.records[0].id;
  fireEvent.change(await screen.findByLabelText('Horse ID'), { target: { value: String(horseId) } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Cross-role review fixture' } });
  await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
  await waitFor(() => expect(readSamples().cases.some((item) => item.reason === 'Cross-role review fixture')).toBe(true));
  const medicalCase = readSamples().cases.find((item) => item.reason === 'Cross-role review fixture')!;
  await screen.findByRole('heading', { name: `Medical Case · ${medicalCase.id}` });
  await userEvent.click(screen.getByRole('tab', { name: 'Examination' }));
  fireEvent.change(screen.getByLabelText('Symptoms and findings'), { target: { value: 'PRIVATE VET FINDINGS' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save examination' }));
  await waitFor(() => expect(readSamples().cases.find((item) => item.id === medicalCase.id)?.examinations).toHaveLength(1));
  await userEvent.click(await screen.findByRole('tab', { name: 'Injury' }));
  const injury = screen.getByRole('tabpanel', { name: 'Injury' });
  await userEvent.selectOptions(within(injury).getByLabelText('Body region'), 'Left Forelimb');
  await userEvent.selectOptions(within(injury).getByLabelText('Severity'), 'MILD');
  await userEvent.selectOptions(within(injury).getByLabelText('Recovery status'), 'IMPROVING');
  await userEvent.click(screen.getByRole('button', { name: 'Save injury' }));
  await waitFor(() => expect(readSamples().cases.find((item) => item.id === medicalCase.id)?.injuries).toHaveLength(1));
  await userEvent.click(await screen.findByRole('tab', { name: 'Treatment' }));
  await userEvent.click(screen.getByRole('link', { name: 'Open treatment plan editor' }));
  fireEvent.change(await screen.findByRole('textbox', { name: /Treatment and medication instructions/ }), { target: { value: 'PRIVATE MEDICATION' } });
  await userEvent.click(screen.getByRole('button', { name: 'Add Groom task' }));
  fireEvent.change(screen.getByLabelText('Groom user ID 1'), { target: { value: String(groom.id) } });
  fireEvent.change(screen.getByLabelText('Groom-safe instruction 1'), { target: { value: 'Observe bedding after care' } });
  fireEvent.change(screen.getByLabelText('Task date 1'), { target: { value: localDay() } });
  await userEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  await screen.findByText('Treatment plan saved');
  const assigned = readSamples().tasks.find((item) => item.caseId === medicalCase.id)!;
  expect(assigned.assignedGroomUserId).toBe(groom.id);
  await logout(view.router);
  await login(foreign);
  await act(() => view.router.navigate(ROUTES.treatmentTasks));
  await screen.findByText('No treatment tasks');
  await expect(requestApi(`/api/groom/treatment-tasks/${assigned.id}/complete`, { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 404 });
  expect(readSamples().tasks.find((item) => item.id === assigned.id)?.status).toBe('PENDING');
  await logout(view.router);
  await login(groom);
  await act(() => view.router.navigate(ROUTES.treatmentTasks));
  await screen.findByText('Observe bedding after care');
  expect(screen.queryByText('PRIVATE MEDICATION')).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE VET FINDINGS')).not.toBeInTheDocument();
  const row = screen.getByText('Observe bedding after care').closest('article')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Mark complete' }));
  await screen.findByText(`Task ${assigned.id} completed.`);
  expect(readSamples().tasks.find((item) => item.id === assigned.id)).toMatchObject({ status: 'COMPLETED', completedByUserId: groom.id });
  view.unmount();
  view = mount(ROUTES.treatmentTasks);
  const restoredRow = (await screen.findByText('Observe bedding after care')).closest('article')!;
  expect(within(restoredRow).getByText(/Completed/)).toBeInTheDocument();
  expect(within(restoredRow).queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  await logout(view.router);
  await login(vet);
  await act(() => view.router.navigate(ROUTES.medicalCaseDetail.replace(':caseId', String(medicalCase.id))));
  await userEvent.click(await screen.findByRole('tab', { name: 'Treatment' }));
  const vetTask = (await screen.findByText('Observe bedding after care')).closest('li')!;
  expect(vetTask).toHaveTextContent('COMPLETED');
  await userEvent.click(screen.getByRole('tab', { name: 'Re-examination' }));
  const recovery = screen.getByRole('tabpanel', { name: 'Re-examination' });
  await userEvent.selectOptions(within(recovery).getByLabelText('Recovery status'), 'RECOVERED');
  fireEvent.change(within(recovery).getByLabelText('Findings'), { target: { value: 'Normal on follow-up' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save re-examination' }));
  await screen.findByRole('button', { name: 'Close case' });
  await userEvent.click(screen.getByRole('button', { name: 'Close case' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  await screen.findByText('CLOSED');
  expect(readSamples().cases.find((item) => item.id === medicalCase.id)?.status).toBe('CLOSED');
  expect(localStorage.getItem('racehorse.business-samples.v1')).not.toBeNull();
  expect(localStorage.getItem('racehorse.medical-demo.v2')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('reports an Incident from the Groom task and shows the same persisted report to the Vet', async () => {
  const view = mount(ROUTES.treatmentTasks);
  await login(groom);
  const assigned = readSamples().tasks.find((item) => item.assignedGroomUserId === groom.id)!;
  await userEvent.click(await screen.findByRole('button', { name: `Report Incident for task ${assigned.id} on horse ${assigned.horseId}` }));
  await userEvent.click(within(screen.getByRole('group', { name: 'Incident type' })).getByRole('button', { name: 'Fever' }));
  await userEvent.click(within(screen.getByRole('group', { name: 'Observed severity' })).getByRole('button', { name: 'Low' }));
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Cross-role fever report' } });
  await userEvent.click(screen.getByRole('button', { name: 'Submit Incident' }));
  await screen.findByText(/Incident INC-\d+ submitted\./);
  const incident = readSamples().incidents.find((item) => item.description === 'Cross-role fever report')!;
  expect(incident).toMatchObject({ reportedByUserId: groom.id, careTaskId: assigned.id });
  await logout(view.router);
  await login(vet);
  await act(() => view.router.navigate(ROUTES.incidentDetail.replace(':incidentId', String(incident.id))));
  await screen.findByText('Cross-role fever report');
  await userEvent.click(screen.getByRole('button', { name: 'Resolve incident' }));
  await waitFor(() => expect(readSamples().incidents.find((item) => item.id === incident.id)?.status).toBe('RESOLVED'));
  expect(fetch).not.toHaveBeenCalled();
});
