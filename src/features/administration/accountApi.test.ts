import { describe, expect, it, vi } from 'vitest';
import { accountApi } from './accountApi';
import type { FlowRequest } from '../main-flows/api';

describe('canonical account adapter', () => {
  it('sends the approved user payload and status to separate real endpoints', async () => {
    const request = vi.fn<FlowRequest>().mockResolvedValue({});
    const api = accountApi(request as FlowRequest), input = { fullName: 'Fixture Name', email: 'fixture@example.test', roleCode: 'TRAINER' as const, experienceYears: null, experienceLevel: null, skillIds: [19] };
    await api.create(input);
    expect(request).toHaveBeenCalledWith('/api/admin/users', { method: 'POST', body: JSON.stringify(input) });
    await api.status(42, 'INACTIVE');
    expect(request).toHaveBeenLastCalledWith('/api/admin/users/42/status', { method: 'PATCH', body: JSON.stringify({ accountStatus: 'INACTIVE' }) });
  });
  it('propagates a failed API write without success or fixture substitution', async () => {
    const error = new Error('SQL unavailable'), request = vi.fn<FlowRequest>().mockRejectedValue(error);
    await expect(accountApi(request as FlowRequest).status(42, 'ACTIVE')).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
