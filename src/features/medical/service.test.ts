import { createMedicalService } from './service';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
describe('CORE-006 HTTP adapter', () => {
  it('sends the approved Vet incident-review shape with the authenticated transport', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ok({ id: 42, status: 'UNDER_REVIEW' }));
    const service = createMedicalService('https://api.example.test/', 'jwt', fetcher);
    await service.reviewIncident(42, 'OPEN_CASE');
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/incidents/42/review',
      expect.objectContaining({ method: 'POST', credentials: 'omit', body: '{"action":"OPEN_CASE"}', headers: expect.objectContaining({ Authorization: 'Bearer jwt' }) }));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('uses only approved review actions and sends a case ID only when linking', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ok({ id: 42 }));
    const service = createMedicalService('', 'jwt', fetcher);
    await service.reviewIncident(42, 'LINK_CASE', 9);
    await service.reviewIncident(42, 'RESOLVE');
    expect(fetcher.mock.calls.map(([, options]) => options.body)).toEqual([
      '{"action":"LINK_CASE","medicalCaseId":9}',
      '{"action":"RESOLVE"}',
    ]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/api/incidents/42/review', '/api/incidents/42/review',
    ]);
  });
  it('keeps independent case creation free of incident linkage and saves assigned treatment tasks', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ok({ id: 9 }));
    const service = createMedicalService('', 'jwt', fetcher);
    await service.createCase({ horseId: 14, reason: 'Lameness' });
    await service.saveTreatment(9, { treatmentMedicationInstructions: 'Vet treatment', groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }] });
    expect(fetcher.mock.calls[0][1].body).toBe('{"horseId":14,"reason":"Lameness"}');
    expect(fetcher.mock.calls[1][0]).toBe('/api/medical/cases/9/treatment-plan');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ treatmentMedicationInstructions: 'Vet treatment', groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }] });
  });
  it('surfaces server business rule errors and connection failures', async () => {
    const conflict = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Active restriction remains' } }), { status: 409 }));
    await expect(createMedicalService('', 'jwt', conflict).closeCase(9)).rejects.toThrow('Active restriction remains');
    const offline = vi.fn().mockRejectedValue(new TypeError('network'));
    await expect(createMedicalService('', 'jwt', offline).getAvailability(14)).rejects.toThrow('Cannot connect');
  });
  it('rejects invalid resource IDs before a request is made', async () => {
    const fetcher = vi.fn();
    expect(() => createMedicalService('', 'jwt', fetcher).getCase(Number.NaN)).toThrow('valid numeric ID');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails closed on a success envelope without data and on forbidden clinical access', async () => {
    const missingData = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    await expect(createMedicalService('', 'jwt', missingData).getCase(9)).rejects.toThrow('invalid API response');
    const forbidden = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Details' } }), { status: 403 }));
    await expect(createMedicalService('', 'jwt', forbidden).getCase(9)).rejects.toThrow('You do not have access');
  });
});
