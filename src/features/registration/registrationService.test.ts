import { ApiError } from '../../shared/auth/authApi';
import { createRegistrationService, parseRegistration } from './registrationService';
import type { RegisterRequest, RegistrationRequest } from './types';
import { queryFromParams, validateQuery, validateRegistration } from './validation';

const input: RegisterRequest = { fullName: ' Applicant ', email: ' applicant@example.test ', password: 'GoodPassword123', confirmPassword: 'GoodPassword123' };
const pending: RegistrationRequest = { id: 5, fullName: 'Applicant', email: 'applicant@example.test', status: 'PENDING_APPROVAL', requestedAt: '2026-10-18T01:00:00Z' };
function transport(data: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: { code: status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', message: 'Request refused', details: [] } }), { status }));
  return { fetcher, service: createRegistrationService({ fetcher, baseUrl: 'https://backend.test/' }) };
}

describe('CORE-048 registration contract', () => {
  it('submits exactly the public DTO without bearer token, role or extra caller fields', async () => {
    const { service, fetcher } = transport({ message: 'Neutral response' }, 202);
    await service.register({ ...input, roles: ['CLUB_MANAGER'], authority: 'ADMIN' } as RegisterRequest);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://backend.test/api/auth/register');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(JSON.parse(String(init?.body))).toEqual({ fullName: 'Applicant', email: 'applicant@example.test', password: input.password, confirmPassword: input.confirmPassword });
  });
  it('sends only approved list parameters and the shared bearer token/abort signal', async () => {
    const { service, fetcher } = transport({ items: [pending], page: 1, size: 20, totalItems: 21, totalPages: 2 });
    const signal = new AbortController().signal;
    await service.list({ status: 'PENDING_APPROVAL', page: 1, size: 20 }, { token: 'test-only', signal });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://backend.test/api/admin/registrations?page=1&size=20&status=PENDING_APPROVAL');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-only');
    expect(init?.signal).toBe(signal);
  });
  it('approves with exactly one roleCode and returns the decided request', async () => {
    const { service, fetcher } = transport({ ...pending, status: 'APPROVED', approvedRoleCode: 'GROOM', createdUserId: 8 });
    expect(await service.approve(5, 'GROOM', { token: 'test-only' })).toMatchObject({ status: 'APPROVED', createdUserId: 8 });
    expect(fetcher.mock.calls[0][0]).toBe('https://backend.test/api/admin/registrations/5/approve');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ roleCode: 'GROOM' });
  });
  it.each(['', '  Reason for review  '])('rejects with only the optional reason (%j)', async (reason) => {
    const { service, fetcher } = transport({ ...pending, status: 'REJECTED' });
    await service.reject(5, reason, { token: 'test-only' });
    expect(fetcher.mock.calls[0][0]).toBe('https://backend.test/api/admin/registrations/5/reject');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(reason.trim() ? { reason: reason.trim() } : {});
  });
  it('projects only safe registration/reviewer fields', () => {
    const result = parseRegistration({ ...pending, password: 'never-display', password_hash: 'never-display', hasPassword: true, reviewedBy: { id: 2, fullName: 'Manager', email: 'hidden@example.test', token: 'never-display' } });
    expect(result).not.toHaveProperty('password'); expect(result).not.toHaveProperty('password_hash'); expect(result).not.toHaveProperty('hasPassword');
    expect(result.reviewedBy).toEqual({ id: 2, fullName: 'Manager', userCode: undefined });
  });
  it.each([null, {}, { ...pending, id: -1 }, { ...pending, status: 'ACTIVE' }, { ...pending, requestedAt: 'yesterday' }, { ...pending, approvedRoleCode: 'SYSTEM' }])('rejects a malformed DTO', (value) => {
    expect(() => parseRegistration(value)).toThrow(ApiError);
  });
  it.each([
    { items: [pending], page: 2, size: 20, totalItems: 1, totalPages: 1 },
    { items: [pending, pending], page: 0, size: 20, totalItems: 2, totalPages: 1 },
    { items: [pending], page: 0, size: 20, totalItems: 1, totalPages: 9 },
  ])('rejects inconsistent page metadata', async (value) => {
    const { service } = transport(value);
    await expect(service.list({ page: 0, size: 20 }, { token: 'test' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects a mutation response that does not confirm the requested decision', async () => {
    const { service } = transport(pending);
    await expect(service.approve(5, 'GROOM', { token: 'test' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(service.reject(5, '', { token: 'test' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([400, 401, 403, 404, 409, 429, 500])('propagates HTTP %s without fallback or retry', async (status) => {
    const { service, fetcher } = transport(null, status);
    await expect(service.approve(5, 'GROOM', { token: 'test' })).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('propagates network failure without fallback and rejects missing neutral data', async () => {
    const { service, fetcher } = transport(null);
    await expect(service.register(input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetcher.mockRejectedValueOnce(new Error('Offline'));
    await expect(service.register(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('blocks invalid IDs, roles, reason and queries before any HTTP request', async () => {
    const { service, fetcher } = transport(null);
    await expect(service.approve(0, 'GROOM', { token: 'test' })).rejects.toMatchObject({ status: 400 });
    await expect(service.approve(5, 'SYSTEM' as 'GROOM', { token: 'test' })).rejects.toMatchObject({ status: 400 });
    await expect(service.reject(5, 'x'.repeat(501), { token: 'test' })).rejects.toMatchObject({ status: 400 });
    await expect(service.list({ page: -1, size: 20 }, { token: 'test' })).rejects.toMatchObject({ status: 400 });
    await expect(service.list({ page: 0, size: 20 }, { token: '' })).rejects.toMatchObject({ status: 401 });
    await expect(service.register({ ...input, confirmPassword: '' })).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('CORE-048 input validation', () => {
  it('accepts contract-compliant credentials without trimming the password', () => {
    expect(validateRegistration({ ...input, password: '  Valid123  ', confirmPassword: '  Valid123  ' })).toEqual({});
  });
  it.each(['short1', 'abcdefgh', '12345678', 'a1'.repeat(33), 'á'.repeat(40) + '1', 'applicant@example.test'])('rejects invalid password without exposing its value (%#)', (password) => {
    const errors = validateRegistration({ ...input, email: 'applicant@example.test', password, confirmPassword: password });
    expect(errors.password).toBeTruthy(); expect(errors.password).not.toContain(password);
  });
  it('checks full name/email/matching confirmation', () => {
    const errors = validateRegistration({ ...input, fullName: ' ', email: 'bad email', confirmPassword: 'different' });
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'fullName']);
  });
  it.each(['page=-1', 'page=1.5', 'size=0', 'size=101', 'status=ACTIVE'])('rejects malformed deep-link query %s', (query) => {
    expect(validateQuery(queryFromParams(new URLSearchParams(query)))).toBeTruthy();
  });
});
