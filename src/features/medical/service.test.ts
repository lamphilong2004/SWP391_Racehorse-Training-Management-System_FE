import { createMedicalService } from './service';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
describe('CORE-006 HTTP adapter', () => {
  it('keeps independent case creation free of incident linkage and saves assigned treatment tasks', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ok({ id: 9 }));
    const service = createMedicalService('jwt', undefined, { baseUrl: '', fetcher });
    await service.createCase({ horseId: 14, reason: 'Lameness' });
    await service.saveTreatment(9, { treatmentMedicationInstructions: 'Vet treatment', groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }] });
    expect(fetcher.mock.calls[0][1].body).toBe('{"horseId":14,"reason":"Lameness"}');
    expect(fetcher.mock.calls[1][0]).toBe('/api/medical/cases/9/treatment-plan');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ treatmentMedicationInstructions: 'Vet treatment', groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }] });
  });
  it('surfaces server business rule errors and connection failures', async () => {
    const conflict = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Active restriction remains' } }), { status: 409 }));
    await expect(createMedicalService('jwt', undefined, { baseUrl: '', fetcher: conflict }).closeCase(9)).rejects.toMatchObject({ status: 409, code: 'BUSINESS_RULE_VIOLATION', message: 'Active restriction remains' });
    const offline = vi.fn().mockRejectedValue(new TypeError('network'));
    await expect(createMedicalService('jwt', undefined, { baseUrl: '', fetcher: offline }).getAvailability(14)).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
  it('rejects invalid resource IDs before a request is made', async () => {
    const fetcher = vi.fn();
    await expect(createMedicalService('jwt', undefined, { baseUrl: '', fetcher }).getCase(Number.NaN)).rejects.toThrow('Cần một mã số hợp lệ.');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails closed on a success envelope without data and on forbidden clinical access', async () => {
    const missingData = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    await expect(createMedicalService('jwt', undefined, { baseUrl: '', fetcher: missingData }).getCase(9)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const forbidden = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Chi tiết' } }), { status: 403 }));
    await expect(createMedicalService('jwt', undefined, { baseUrl: '', fetcher: forbidden }).getCase(9)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Chi tiết' });
  });
  it('uses CORE-006 clinical paths and bodies, retaining typed 409 errors', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ok({ id: 1 }));
    const service = createMedicalService('jwt', undefined, { baseUrl: '', fetcher });
    await service.addExamination(9, { symptoms: 'Lame', examinedAt: '2026-10-17T01:00:00Z' });
    await service.addInjury(9, { bodyRegion: 'LEFT_FORELEG', severity: 'MODERATE', recoveryStatus: 'NOT_RECOVERED' });
    await service.addReexamination(9, { recoveryStatus: 'RECOVERED', findings: 'Normal gait', examinedAt: '2026-10-18T01:00:00Z' });
    await service.closeCase(9);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
      ['/api/medical/cases/9/examinations', 'POST', '{"symptoms":"Lame","examinedAt":"2026-10-17T01:00:00Z"}'],
      ['/api/medical/cases/9/injuries', 'POST', '{"bodyRegion":"LEFT_FORELEG","severity":"MODERATE","recoveryStatus":"NOT_RECOVERED"}'],
      ['/api/medical/cases/9/re-examinations', 'POST', '{"recoveryStatus":"RECOVERED","findings":"Normal gait","examinedAt":"2026-10-18T01:00:00Z"}'],
      ['/api/medical/cases/9/close', 'POST', undefined],
    ]);
    const methods = [
      () => service.addExamination(9, { symptoms: 'Lame', examinedAt: '2026-10-17T01:00:00Z' }),
      () => service.addInjury(9, { bodyRegion: 'LEFT_FORELEG', severity: 'MODERATE', recoveryStatus: 'NOT_RECOVERED' }),
      () => service.saveTreatment(9, { treatmentMedicationInstructions: 'Nghỉ ngơi' }),
      () => service.addReexamination(9, { recoveryStatus: 'RECOVERED', findings: 'Bình thường', examinedAt: '2026-10-18T01:00:00Z' }),
      () => service.closeCase(9),
    ];
    fetcher.mockImplementation(async () => failConflict());
    for (const run of methods) await expect(run()).rejects.toMatchObject({ status: 409, code: 'CONFLICT', message: 'Clinical state changed' });
  });
});

function failConflict() {
  return new Response(JSON.stringify({ success: false, error: { code: 'CONFLICT', message: 'Clinical state changed', details: [] } }), { status: 409 });
}
