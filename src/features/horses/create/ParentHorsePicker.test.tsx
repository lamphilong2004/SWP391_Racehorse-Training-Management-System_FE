import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHorsesApi, type HttpClient } from '../api/horsesApi';
import type { HorseDetail, Page } from '../api/types';
import { HorseRecordPicker } from '../shared/HorseRecordPicker';

const horse = (id: number, name: string, horseCode: string) => ({ id, name, horseCode }) as HorseDetail;
const page = (items: HorseDetail[], index = 0, totalPages = 1): Page<HorseDetail> => ({ items, page: index, size: 20, totalItems: 41, totalPages });
function setup(handler: (query?: Record<string, string | number | undefined>) => Promise<Page<HorseDetail>>) {
  const request = vi.fn(async (_method: string, _path: string, config?: { query?: Record<string, string | number | undefined> }) => handler(config?.query));
  const api = createHorsesApi({ request } as unknown as HttpClient);
  const onSelected = vi.fn();
  const view = render(<HorseRecordPicker api={api} horseId={7} otherParentId={93} kind="sire" onClose={vi.fn()} onSelected={onSelected} />);
  return { ...view, request, onSelected };
}
it('excludes the current horse and distinguishes identical names by real ID and code', async () => {
  const state = setup(async () => page([horse(7, 'Current', 'SELF'), horse(91, 'Same name', 'SIRE-91'), horse(92, 'Same name', 'SIRE-92'), horse(93, 'Other parent', 'DAM-93')]));
  expect(await screen.findByRole('radio', { name: 'Same name · SIRE-91' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Current · SELF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Other parent · DAM-93' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dùng hồ sơ đã chọn' })).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: 'Same name · SIRE-92' }));
  await userEvent.click(screen.getByRole('button', { name: 'Dùng hồ sơ đã chọn' }));
  expect(state.onSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 92, horseCode: 'SIRE-92' }));
});
it('uses server search/pagination and resets selection between result pages', async () => {
  const state = setup(async query => page([horse(91, 'Parent', 'P-91')], Number(query?.page ?? 0), 3));
  await screen.findByRole('radio', { name: 'Parent · P-91' });
  await userEvent.click(screen.getByRole('radio', { name: 'Parent · P-91' }));
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(state.request).toHaveBeenLastCalledWith('GET', '/api/horses', { query: { q: undefined, page: 1, size: 20 } }));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Parent · P-91' })).not.toBeChecked());
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' SIRE ' } });
  await userEvent.click(screen.getByRole('button', { name: 'Tìm ngựa' }));
  expect(state.request).toHaveBeenLastCalledWith('GET', '/api/horses', { query: { q: 'SIRE', page: 0, size: 20 } });
});
it('shows API errors without fixtures and can retry the same search', async () => {
  let fail = true;
  setup(async () => { if (fail) throw new Error('Không có kết nối'); return page([horse(91, 'Real', 'P-91')]); });
  await screen.findByText('Không có kết nối');
  expect(screen.getByRole('button', { name: 'Dùng hồ sơ đã chọn' })).toBeDisabled();
  fail = false;await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
  expect(await screen.findByRole('radio', { name: 'Real · P-91' })).toBeInTheDocument();
});
it('ignores late results after the picker unmounts', async () => {
  let resolve!: (data: Page<HorseDetail>) => void;
  const state = setup(() => new Promise(done => { resolve = done; }));
  await waitFor(() => expect(resolve).toBeDefined());state.unmount();
  await act(async () => resolve(page([horse(91, 'Late', 'P-91')])));
  expect(state.onSelected).not.toHaveBeenCalled();
});

it('keeps the latest search when an earlier request returns late', async () => {
  let initial!: (data: Page<HorseDetail>) => void;
  const state = setup(query => query?.q ? Promise.resolve(page([horse(92, 'Latest', 'P-92')])) : new Promise(done => { initial = done; }));
  await waitFor(() => expect(initial).toBeDefined());
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Latest' } });
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
  await screen.findByRole('radio', { name: 'Latest · P-92' });
  await act(async () => initial(page([horse(91, 'Stale', 'P-91')])));
  expect(screen.queryByRole('radio', { name: 'Stale · P-91' })).not.toBeInTheDocument();
  expect(state.onSelected).not.toHaveBeenCalled();
});
