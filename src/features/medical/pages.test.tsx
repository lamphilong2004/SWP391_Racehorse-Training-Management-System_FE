import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MedicalAccess, MedicalProvider } from './runtime';
import { CaseListPage, CaseDetailPage, CreateCasePage, TreatmentTaskListPage, TreatmentTaskDetailPage } from './pages';
import { createMockMedicalService } from './service';
import { ROLE_CODES } from '../../shared/auth/roles';
import type { MedicalActor, MedicalService } from './models';

const vet: MedicalActor = { id: 5, fullName: 'Dr. Le', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' };
const groom: MedicalActor = { id: 6, fullName: 'Assigned Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' };
function mount(path: string, actor = vet, service: MedicalService = createMockMedicalService(actor)) {
  const router = createMemoryRouter([
    { element: <MedicalAccess role="VETERINARIAN" />, children: [
      { path: '/medical', element: <CaseListPage /> },
      { path: '/medical/cases/new', element: <CreateCasePage /> },
      { path: '/medical/cases/:caseId', element: <CaseDetailPage /> },
    ] },
    { element: <MedicalAccess role="GROOM" />, children: [
      { path: '/care/tasks/treatment', element: <TreatmentTaskListPage /> },
      { path: '/care/tasks/treatment/:taskId', element: <TreatmentTaskDetailPage /> },
    ] },
  ], { initialEntries: [path] });
  render(<MedicalProvider value={{ actor, service }}><RouterProvider router={router} /></MedicalProvider>);
  return router;
}
describe('CORE-036 medical pages', () => {
  it('renders loading then case data and the mock disclosure', async () => {
    mount('/medical', vet, createMockMedicalService(vet, { delayMs: 20 }));
    expect(screen.getAllByText(/Loading medical data/)).toHaveLength(2);
    expect(await screen.findByRole('link', { name: 'MED-02' })).toBeInTheDocument();
    expect(screen.getByText('Mock medical workspace')).toBeInTheDocument();
  });
  it('filters cases and renders an empty state', async () => {
    mount('/medical');
    await screen.findByRole('link', { name: 'MED-02' });
    await userEvent.type(screen.getByLabelText('Search cases'), 'unknown');
    expect(screen.getByText('No medical cases')).toBeInTheDocument();
  });
  it('renders the service empty state', async () => {
    mount('/medical', vet, createMockMedicalService(vet, { empty: true }));
    expect(await screen.findByText('No medical cases')).toBeInTheDocument();
  });
  it('shows read errors and retries successfully', async () => {
    const service = createMockMedicalService(vet);
    vi.spyOn(service, 'listCases').mockRejectedValueOnce(new Error('Offline'));
    mount('/medical', vet, service);
    expect(await screen.findByText('Offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'MED-02' })).toBeInTheDocument();
  });
  it.each(ROLE_CODES.filter((role) => role !== 'VETERINARIAN'))('denies %s before a medical request', (role) => {
    const service = createMockMedicalService(groom);
    const spy = vi.spyOn(service, 'listCases');
    mount('/medical', { ...groom, roles: [role] }, service);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText('Medical Cases')).not.toBeInTheDocument();
  });
  it('validates case creation and navigates to the created case', async () => {
    const router = mount('/medical/cases/new');
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    expect(screen.getByText('Horse ID is required')).toBeInTheDocument();
    expect(screen.getByText('Reason is required')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Horse ID'), 'TB-001');
    await userEvent.type(screen.getByLabelText('Reason'), 'Lameness');
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/medical\/cases\/MED-/));
    expect(await screen.findByText('TB-001 · Lameness')).toBeInTheDocument();
  });
  it('shows a failed creation without navigation', async () => {
    const service = createMockMedicalService(vet, { fail: true });
    const router = mount('/medical/cases/new', vet, service);
    await userEvent.type(screen.getByLabelText('Horse ID'), 'TB-001');
    await userEvent.type(screen.getByLabelText('Reason'), 'Review');
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    expect(await screen.findByText(/Simulated service failure/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/medical/cases/new');
  });
  it('validates examinations and partial 3D coordinates', async () => {
    mount('/medical/cases/MED-02');
    await screen.findByRole('tab', { name: 'Examination' });
    await userEvent.click(screen.getByRole('tab', { name: 'Examination' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save examination' }));
    expect(screen.getByText('Symptoms is required')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Injury' }));
    await userEvent.selectOptions(screen.getByLabelText('Body region'), 'Head');
    await userEvent.type(screen.getByLabelText('Injury severity'), 'Mild');
    await userEvent.type(screen.getByLabelText('3D x (optional)'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Save injury' }));
    expect(await screen.findByText('Provide all three coordinates or leave them empty')).toBeInTheDocument();
  });
  it('saves an examination and re-examination with recovery tracking', async () => {
    mount('/medical/cases/MED-02');
    await screen.findByRole('tab', { name: 'Examination' });
    await userEvent.click(screen.getByRole('tab', { name: 'Examination' }));
    await userEvent.type(screen.getByLabelText('Symptoms'), 'No uneven gait today');
    await userEvent.click(screen.getByRole('button', { name: 'Save examination' }));
    expect(await screen.findByText('No uneven gait today', { selector: 'p' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Recovery' }));
    await userEvent.selectOptions(screen.getByLabelText('Recovery status'), 'RECOVERED');
    await userEvent.type(screen.getByLabelText('Findings'), 'Gait normal');
    await userEvent.click(screen.getByRole('button', { name: 'Save re-examination' }));
    expect(await screen.findByText('Gait normal', { selector: 'p' })).toBeInTheDocument();
  });
  it('confirms closure and removes clinical editors', async () => {
    mount('/medical/cases/MED-02');
    await screen.findByRole('button', { name: 'Close case' });
    await userEvent.click(screen.getByRole('button', { name: 'Close case' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
    expect(await screen.findByText('Case closed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save examination' })).not.toBeInTheDocument();
  });
});
describe('Groom treatment UI', () => {
  it('shows pending and completed own tasks, with no clinical editing', async () => {
    mount('/care/tasks/treatment', groom);
    expect(await screen.findByRole('link', { name: 'TASK-02' })).toBeInTheDocument();
    expect(screen.getByText('PENDING', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('COMPLETED', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('TASK-PRIVATE')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Diagnosis')).not.toBeInTheDocument();
  });
  it('acknowledges completion and displays notes', async () => {
    mount('/care/tasks/treatment/TASK-02', groom);
    await screen.findByLabelText('Completion notes (optional)');
    await userEvent.type(screen.getByLabelText('Completion notes (optional)'), 'Compress applied');
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge completion' }));
    expect(await screen.findByText('Treatment acknowledged')).toBeInTheDocument();
    expect(screen.getByText('Compress applied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge completion' })).not.toBeInTheDocument();
  });
  it('keeps the task pending on failed acknowledgement and allows retry', async () => {
    const service = createMockMedicalService(groom);
    vi.spyOn(service, 'completeTask').mockRejectedValueOnce(new Error('Completion failed'));
    mount('/care/tasks/treatment/TASK-02', groom, service);
    await screen.findByRole('button', { name: 'Acknowledge completion' });
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge completion' }));
    expect(await screen.findByText('Completion failed')).toBeInTheDocument();
    expect(screen.getByText('State: PENDING')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge completion' }));
    expect(await screen.findByText('Treatment acknowledged')).toBeInTheDocument();
  });
  it('does not expose another Groom task by URL', async () => {
    mount('/care/tasks/treatment/TASK-PRIVATE', groom);
    expect(await screen.findByText('Assigned treatment task not found')).toBeInTheDocument();
    expect(screen.queryByText('Private assignment')).not.toBeInTheDocument();
  });
  it('renders an empty assigned list', async () => {
    mount('/care/tasks/treatment', groom, createMockMedicalService(groom, { empty: true }));
    expect(await screen.findByText('No assigned treatment tasks')).toBeInTheDocument();
  });
  it('denies veterinarians access to Groom work-list operations', () => {
    mount('/care/tasks/treatment', vet);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});



describe('treatment and injury editing', () => {
  it('validates repeated medication and care-task inputs', async () => {
    mount('/medical/cases/MED-02');
    await screen.findByRole('tab', { name: 'Treatment' });
    await userEvent.click(screen.getByRole('tab', { name: 'Treatment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add medication' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
    expect(await screen.findByText('Every medication needs a name')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove medication 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add care task' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
    expect(await screen.findByText('Every care task needs an instruction')).toBeInTheDocument();
  });
  it('saves multiple medication/instruction rows and remains on the treatment panel', async () => {
    const service = createMockMedicalService(vet);
    mount('/medical/cases/MED-02', vet, service);
    await screen.findByRole('tab', { name: 'Treatment' });
    await userEvent.click(screen.getByRole('tab', { name: 'Treatment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add medication' }));
    await userEvent.type(screen.getByLabelText('Medication name 1'), 'Vet prescribed medicine');
    await userEvent.click(screen.getByRole('button', { name: 'Add care task' }));
    await userEvent.type(screen.getByLabelText('Groom treatment instruction 2'), 'Observe swelling');
    await userEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
    expect(await screen.findByText('Treatment plan saved')).toBeInTheDocument();
    const saved = await service.getCase('MED-02');
    expect(saved.treatment?.medications?.[0].name).toBe('Vet prescribed medicine');
    expect(saved.treatment?.groomTasks).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Treatment' })).toHaveAttribute('aria-selected', 'true');
  });
  it('keeps entered treatment instructions after save failure', async () => {
    const service = createMockMedicalService(vet);
    vi.spyOn(service, 'saveTreatment').mockRejectedValueOnce(new Error('Plan save failed'));
    mount('/medical/cases/MED-02', vet, service);
    await screen.findByRole('tab', { name: 'Treatment' });
    await userEvent.click(screen.getByRole('tab', { name: 'Treatment' }));
    await userEvent.clear(screen.getByLabelText('Rest instructions'));
    await userEvent.type(screen.getByLabelText('Rest instructions'), 'New care instructions');
    await userEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
    expect(await screen.findByText('Plan save failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Rest instructions')).toHaveValue('New care instructions');
    expect((await service.getCase('MED-02')).treatment?.restInstructions).not.toBe('New care instructions');
  });
  it('selects 2D regions and saves all three coordinates without a 3D dependency', async () => {
    const service = createMockMedicalService(vet);
    mount('/medical/cases/MED-02', vet, service);
    await screen.findByRole('tab', { name: 'Injury' });
    await userEvent.click(screen.getByRole('tab', { name: 'Injury' }));
    await userEvent.click(screen.getByRole('button', { name: /^Head$/ }));
    expect(screen.getByText('No injury in this region')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Body region'), 'Head');
    await userEvent.type(screen.getByLabelText('Injury severity'), 'Mild');
    for (const axis of ['x', 'y', 'z']) await userEvent.type(screen.getByLabelText('3D ' + axis + ' (optional)'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save injury' }));
    await waitFor(async () => expect((await service.getCase('MED-02')).injuries).toHaveLength(2));
    expect((await service.getCase('MED-02')).injuries[1].position3d).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('prefills case creation from the incident review link', async () => {
    mount('/medical');
    await userEvent.click(await screen.findByRole('link', { name: 'Open case from INC-02' }));
    expect(await screen.findByLabelText('Horse ID')).toHaveValue('ST-014');
    expect(screen.getByLabelText('Linked incident ID (optional)')).toHaveValue('INC-02');
  });
  it('filters the assigned Groom list by completion state', async () => {
    mount('/care/tasks/treatment', groom);
    await screen.findByRole('link', { name: 'TASK-02' });
    await userEvent.selectOptions(screen.getByLabelText('Treatment task state'), 'COMPLETED');
    expect(screen.queryByRole('link', { name: 'TASK-02' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TASK-03' })).toBeInTheDocument();
  });
});
