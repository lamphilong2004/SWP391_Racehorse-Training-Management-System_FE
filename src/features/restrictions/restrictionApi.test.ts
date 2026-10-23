import { createRestrictionApi } from './restrictionApi';

it('finds an active restriction beyond page zero using medical totalElements metadata', async () => {
  const record = { id: 12, horseId: 7, level: 'LIMITED', reason: 'Walk only', effectiveAt: '2026-10-19T06:00:00Z' };
  const request = vi.fn().mockResolvedValueOnce({ items: [], page: 0, size: 100, totalElements: 101 })
    .mockResolvedValueOnce({ items: [record], page: 1, size: 100, totalElements: 101 });
  const signal = new AbortController().signal;
  expect(await createRestrictionApi(request).find(12, signal)).toEqual(record);
  expect(request.mock.calls).toEqual([
    ['/api/medical/restrictions?page=0&size=100', { signal }],
    ['/api/medical/restrictions?page=1&size=100', { signal }],
  ]);
});
it('ends at the last contract page and surfaces invalid metadata instead of silently omitting rules', async () => {
  const request = vi.fn().mockResolvedValue({ items: [], page: 0, size: 100, totalElements: 0 });
  expect(await createRestrictionApi(request).find(12)).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue({ items: [], totalPages: 2 });
  await expect(createRestrictionApi(request).find(12)).rejects.toThrow('Không phân trang được danh sách hạn chế. Hãy tải lại trước khi sửa quy tắc.');
});
