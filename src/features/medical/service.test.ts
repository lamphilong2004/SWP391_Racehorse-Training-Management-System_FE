import { createMedicalService, createMockMedicalService } from './service';
import type { MedicalActor } from './models';

const vet: MedicalActor = { id: 5, fullName: 'Dr. Le', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' };
const groom: MedicalActor = { id: 6, fullName: 'Assigned Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' };
describe('medical service boundary', () => {
  it('does not enable draft HTTP medical operations without explicit mock configuration', async () => {
    const service = createMedicalService(vet, false);
    expect(service.mode).toBe('unavailable');
    await expect(service.listCases()).rejects.toThrow('CORE-006');
  });
  it('keeps cases and writes behind veterinarian authorization', async () => {
    const service = createMockMedicalService(groom);
    await expect(service.listCases()).rejects.toThrow('Forbidden');
    await expect(service.getCase('MED-02')).rejects.toThrow('Forbidden');
    await expect(service.addExamination('MED-02', { symptoms: 'x' })).rejects.toThrow('Forbidden');
    await expect(service.saveTreatment('MED-02', {})).rejects.toThrow('Forbidden');
    await expect(service.closeCase('MED-02')).rejects.toThrow('Forbidden');
  });
  it('blocks inactive actors', async () => {
    await expect(createMockMedicalService({ ...vet, accountStatus: 'INACTIVE' }).listCases()).rejects.toThrow('Forbidden');
  });
  it('returns only own assigned tasks and denies forged task completion', async () => {
    const service = createMockMedicalService(groom);
    const tasks = await service.listTasks();
    expect(tasks.map((task) => task.id)).toEqual(['TASK-02', 'TASK-03']);
    expect(tasks[0]).not.toHaveProperty('assignedTo');
    await expect(service.completeTask('TASK-PRIVATE', {})).rejects.toThrow('not found');
    await expect(createMockMedicalService(vet).listTasks()).rejects.toThrow('Forbidden');
  });
  it('acknowledges completion with notes and rejects repeated acknowledgement', async () => {
    const service = createMockMedicalService(groom);
    await service.completeTask('TASK-02', { completionNotes: 'Care completed' });
    expect((await service.listTasks())[0]).toMatchObject({ status: 'COMPLETED', completionNotes: 'Care completed' });
    await expect(service.completeTask('TASK-02', {})).rejects.toThrow('already completed');
  });
  it('validates required case/exam/injury fields and finite coordinates', async () => {
    const service = createMockMedicalService(vet);
    await expect(service.createCase({ horseId: ' ', reason: 'Reason' })).rejects.toThrow('Horse ID');
    await expect(service.addExamination('MED-02', { symptoms: '' })).rejects.toThrow('Symptoms');
    await expect(service.addInjury('MED-02', { bodyRegion: 'Head', severity: 'Mild', position3d: { x: Infinity, y: 0, z: 0 } })).rejects.toThrow('finite');
  });
  it('supports the case lifecycle and prevents edits after closure', async () => {
    const service = createMockMedicalService(vet, { empty: true });
    const item = await service.createCase({ horseId: 'TB-001', reason: 'Observed lameness' });
    await service.addExamination(item.id, { symptoms: 'Lameness', diagnosis: 'Review required' });
    await service.addInjury(item.id, { bodyRegion: 'Left Forelimb', severity: 'Mild' });
    await service.saveTreatment(item.id, { restInstructions: 'Rest', groomTasks: [{ instruction: 'Observe' }] });
    await service.addReexamination(item.id, { recoveryStatus: 'RECOVERED', findings: 'Gait normal' });
    const detail = await service.getCase(item.id);
    expect(detail.examinations).toHaveLength(1);
    expect(detail.injuries).toHaveLength(1);
    expect(detail.reexaminations[0].recoveryStatus).toBe('RECOVERED');
    await service.closeCase(item.id);
    await expect(service.saveTreatment(item.id, {})).rejects.toThrow('closed');
  });
  it('isolates fixtures between instances and copies read values', async () => {
    const a = createMockMedicalService(vet);
    const detail = await a.getCase('MED-02');
    detail.examinations.length = 0;
    expect((await a.getCase('MED-02')).examinations).toHaveLength(1);
    await a.closeCase('MED-02');
    expect((await createMockMedicalService(vet).getCase('MED-02')).status).toBe('OPEN');
  });
  it('does not assign treatment instructions to arbitrary Grooms', async () => {
    const service = createMockMedicalService({ ...groom, id: 99 });
    expect((await service.listTasks()).map((task) => task.id)).toEqual(['TASK-PRIVATE']);
  });
  it('exposes explicit empty and failure scenarios', async () => {
    expect(await createMockMedicalService(groom, { empty: true }).listTasks()).toEqual([]);
    await expect(createMockMedicalService(groom, { fail: true }).completeTask('TASK-02', {})).rejects.toThrow('Simulated service failure');
  });
});
