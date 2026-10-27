import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { requestApi, createAuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { getBusinessActor, setBusinessActor } from '../../shared/data/businessData';
import { readSamples, resetSamples, saveSamples } from '../../shared/data/sampleStore';
import type { HorseDetail } from './api/types';

const manager: CurrentUser = { id: 201, userCode: 'TEST-CM', fullName: 'Test Manager', email: 'manager@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); setBusinessActor(null); resetSamples(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setBusinessActor(null); });
function open(path: string, user = manager) {
  authSession.save('test-real-auth-token', 3600, false);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={{ login: vi.fn(), currentUser: async () => user, logout: async () => undefined }}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
it('registers, declares ownership, assigns a FREE box and shows pending baseline without manual activation', async () => {
  const router = open('/horses/new'), user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Thêm ngựa' });
  await user.type(screen.getByLabelText('Tên ngựa *'), 'River Dance');
  await user.type(screen.getByLabelText('Mã ngựa *'), 'RD-015');
  fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '2023-03-14' } });
  await user.selectOptions(screen.getByLabelText('Giới tính'), 'Filly');
  await user.selectOptions(screen.getByLabelText('Giống ngựa'), 'Thoroughbred');
  await user.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · River Dance' });
  const id = Number(router.state.location.pathname.split('/')[2]);
  await user.type(screen.getByLabelText('Ngựa cha *'), 'Northern Crest');
  await user.type(screen.getByLabelText('Ngựa mẹ *'), 'Silver Lining');
  await user.selectOptions(screen.getByLabelText('Chủ ngựa'), '17');
  await user.type(screen.getByLabelText('Tỷ lệ sở hữu (%)'), '65');
  await user.click(screen.getByRole('button', { name: 'Xếp ô chuồng' }));
  await user.click(await screen.findByRole('button', { name: /B-07/ }));
  await user.click(screen.getByRole('button', { name: /^Xác nhận xếp ô$/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Lưu & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Chờ kích hoạt' });
  expect(await screen.findByText(/River Dance tự chuyển sang Hoạt động/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Approve|Activate horse/ })).not.toBeInTheDocument();
  const saved = await requestApi<{ lifecycle: string; activatedAt: string | null; currentOwnerships: { sharePercentage: number }[] }>(`/api/horses/${id}`);
  expect(saved.lifecycle).toBe('DRAFT'); expect(saved.activatedAt).toBeNull(); expect(saved.currentOwnerships[0].sharePercentage).toBe(65);
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps registration input on duplicate code and can retry with corrected code', async () => {
  open('/horses/new'); const user = userEvent.setup(); await screen.findByRole('heading', { name: 'Thêm ngựa' });
  await user.type(screen.getByLabelText('Tên ngựa *'), 'Retry Horse'); await user.type(screen.getByLabelText('Mã ngựa *'), 'RH-007');
  fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '2021-03-01' } });
  await user.selectOptions(screen.getByLabelText('Giới tính'), 'Mare'); await user.selectOptions(screen.getByLabelText('Giống ngựa'), 'Arabian');
  await user.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  expect(await screen.findByText('Horse code or registration number is already used.')).toBeInTheDocument();
  expect(screen.getByLabelText('Tên ngựa *')).toHaveValue('Retry Horse');
  await user.clear(screen.getByLabelText('Mã ngựa *')); await user.type(screen.getByLabelText('Mã ngựa *'), 'RETRY-008');
  await user.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  expect(await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Retry Horse' })).toBeInTheDocument();
});
it('lists and opens the existing horse profile and keeps Vet clinical fields read-only', async () => {
  open('/horses', { ...manager, roles: ['GROOM'] });
  await userEvent.click(await screen.findByRole('link', { name: /Thunder Bolt/ }));
  expect(await screen.findByRole('heading', { name: 'Thunder Bolt' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Sửa thông tin nhận dạng' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Set health|Activate/ })).not.toBeInTheDocument();
});
it('denies non-Manager onboarding before mounting a form', async () => {
  open('/horses/new', { ...manager, roles: ['GROOM'] });
  expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
  expect(screen.queryByLabelText('Tên ngựa *')).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps real auth out of samples and clears the sample actor at logout', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600, user: manager } }), { status: 200 }));
  await createAuthApi({ fetcher }).login({ email: manager.email, password: 'test-input-only' });
  expect(fetcher).toHaveBeenCalledOnce();
  open('/dashboard'); await screen.findByRole('heading', { name: 'Tổng quan Club Manager' });
  expect(getBusinessActor()?.id).toBe(201);
  await userEvent.click(screen.getByRole('button', { name: 'Menu tài khoản' }));
  await screen.findByRole('heading', { name: 'Tài khoản của tôi' });
  await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
  await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' }); expect(getBusinessActor()).toBeNull();
});
it('API mode never falls back to samples on 404, 403 or network failure', async () => {
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  for (const status of [403, 404]) {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: 'Real API error' } }), { status }));
    await expect(requestApi('/api/horses', {}, { fetcher })).rejects.toMatchObject({ status, message: 'Real API error' });
  }
  await expect(requestApi('/api/horses', {}, { fetcher: vi.fn().mockRejectedValue(new Error('offline')) })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
});
it.each([404, 503])('keeps a created identity reachable when supporting APIs return %s (transport fixtures only)', async (supportStatus) => {
  setBusinessActor(manager);
  const base = await requestApi<HorseDetail>('/api/horses/7');
  const created = { ...base, id: 501, horseCode: 'TRANSPORT-501', name: 'Transport Draft', lifecycle: 'DRAFT' as const };
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    let data: unknown;
    let status = 200;
    if (path === '/api/horses' && init?.method === 'POST') { data = created; status = 201; }
    else if (path === '/api/horses/501') data = created;
    else if (path === '/api/horses') data = { items: [created], page: 0, size: 20, totalItems: 1, totalPages: 1 };
    else return Promise.resolve(new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Supporting API unavailable' } }), { status: supportStatus }));
    return Promise.resolve(new Response(JSON.stringify({ success: true, data }), { status }));
  });
  vi.stubGlobal('fetch', fetcher);
  const router = open('/horses/new');
  await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: created.name } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: created.horseCode } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByText('Không tải được dữ liệu thiết lập ngựa');
  expect(screen.queryByText('Không tìm thấy ngựa này.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Không tải được dữ liệu thiết lập ngựa');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: /^Quay lại danh sách ngựa$/ }));
  await screen.findByRole('heading', { name: 'Danh sách ngựa' });
  fireEvent.click(screen.getByRole('link', { name: /Transport Draft/ }));
  await screen.findByRole('heading', { name: created.name });
  expect(router.state.location.pathname).toBe('/horses/501');
});
it('retains the identity 404 error without offering an unverified saved profile', async () => {
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy ngựa' } }), { status: 404 })));
  open('/horses/501/edit');
  await screen.findByText('Không tìm thấy ngựa này.');
  expect(screen.queryByRole('link', { name: 'Xem hồ sơ ngựa đã lưu' })).not.toBeInTheDocument();
});
it.each(['owners', 'assignments', 'activation'] as const)('keeps the form visible without inventing missing %s data (HTTP fixtures)', async (missing) => {
  setBusinessActor(manager);
  const horse = await requestApi<HorseDetail>('/api/horses/7');
  const activation = await requestApi('/api/horses/7/activation-status');
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const resource = path === '/api/admin/users' ? 'owners' : path.endsWith('/stable-assignments') ? 'assignments' : path.endsWith('/activation-status') ? 'activation' : 'horse';
    const data = resource === 'horse' ? horse : resource === 'owners' ? { items: [], page: 0, size: 100, totalItems: 0, totalPages: 0 } : resource === 'assignments' ? [] : activation;
    return Promise.resolve(new Response(JSON.stringify(resource === missing ? { success: false, error: { code: 'FORBIDDEN', message: 'Không có quyền truy cập' } } : { success: true, data }), { status: resource === missing ? 403 : 200 }));
  });
  vi.stubGlobal('fetch', fetcher);
  open('/horses/7/edit');
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Thunder Bolt' });
  expect(screen.getByLabelText('Ngựa cha *')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Lưu & tiếp tục' })).toBeDisabled();
  expect(screen.getByLabelText('Chủ ngựa')).toHaveProperty('disabled', missing === 'owners');
  if (missing === 'assignments') {
    expect(screen.getByText('Không tải được lịch sử ô chuồng')).toBeInTheDocument();
    expect(screen.queryByText(/Lịch sử ô chuồng: chưa có — ngựa mới đến/)).not.toBeInTheDocument();
  }
  if (missing === 'activation') {
    expect(screen.getByText('Không tải được trạng thái khám ban đầu')).toBeInTheDocument();
    expect(screen.queryByText('Chưa ghi (Veterinarian)')).not.toBeInTheDocument();
  }
  fireEvent.submit(screen.getByRole('button', { name: 'Lưu & tiếp tục' }).closest('form')!);
  expect(fetcher.mock.calls).toHaveLength(4);
});
it('retains typed and deliberately cleared fields across setup retry, then sends only contracted payloads (HTTP fixtures)', async () => {
  setBusinessActor(manager);
  const base = await requestApi<HorseDetail>('/api/horses/7');
  const horse = { ...base, currentOwnerships: [] };
  const activation = await requestApi('/api/horses/7/activation-status');
  let available = false;
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const failed = path.endsWith('/activation-status') && !available;
    const data = path === '/api/admin/users' ? { items: [{ id: 17, fullName: 'Test Owner', userCode: 'OWNER-17', email: 'owner@example.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' }], page: 0, size: 100, totalItems: 1, totalPages: 1 }
      : path.endsWith('/activation-status') ? activation : path.endsWith('/stable-assignments') ? [] : path.endsWith('/pending-activation') || path === '/api/horses' ? { items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 } : horse;
    return Promise.resolve(new Response(JSON.stringify(failed ? { success: false, error: { code: 'NOT_FOUND', message: 'Not implemented' } } : { success: true, data }), { status: failed ? 404 : init?.method === 'POST' ? 201 : 200 }));
  });
  vi.stubGlobal('fetch', fetcher);
  open('/horses/7/edit');
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Thunder Bolt' });
  fireEvent.change(screen.getByLabelText('Ngựa cha *'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Ngựa mẹ *'), { target: { value: 'Edited Dam' } });
  fireEvent.change(screen.getByLabelText('Chủ ngựa'), { target: { value: '17' } });
  fireEvent.change(screen.getByLabelText('Tỷ lệ sở hữu (%)'), { target: { value: '65' } });
  available = true;
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu & tiếp tục' })).toBeEnabled());
  expect(screen.getByLabelText('Ngựa cha *')).toHaveValue('');
  expect(screen.getByLabelText('Ngựa mẹ *')).toHaveValue('Edited Dam');
  expect(screen.getByLabelText('Chủ ngựa')).toHaveValue('17');
  expect(screen.getByLabelText('Tỷ lệ sở hữu (%)')).toHaveValue(65);
  fireEvent.click(screen.getByRole('button', { name: 'Lưu & tiếp tục' }));
  expect(await screen.findByText('Nhập ngựa cha.')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT' || init?.method === 'POST')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Ngựa cha *'), { target: { value: 'Edited Sire' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Chờ kích hoạt' });
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT' || init?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ sire: { horseId: null, name: 'Edited Sire' }, dam: { horseId: null, name: 'Edited Dam' } });
  expect(JSON.parse(String(writes[1][1]?.body))).toMatchObject({ ownerUserId: 17, sharePercentage: 65, isManagingOwner: false });
});
it('preserves existing parent references and ownership when saving unchanged pedigree', async () => {
  setBusinessActor(manager); await requestApi('/api/horses/7');
  const data = readSamples(); data.horseRegistry!.records[0].pedigree.sire = { horseId: 91, name: 'Northern Star', horseCode: 'SIRE-91' }; saveSamples(data);
  open('/horses/7/edit'); await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Thunder Bolt' });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Chờ kích hoạt' });
  const horse = readSamples().horseRegistry!.records[0];
  expect(horse.pedigree.sire).toEqual({ horseId: 91, name: null });
  expect(horse.currentOwnerships).toHaveLength(1); expect(horse.currentOwnerships[0].sharePercentage).toBe(100);
});
it('preserves a server-supplied sex value outside the Figma suggestions while editing identity', async () => {
  open('/horses/7/identity'); await screen.findByDisplayValue('Thunder Bolt');
  expect(screen.getByRole('combobox', { name: 'Giới tính' })).toHaveValue('GELDING');
  expect(screen.getByRole('option', { name: 'Ngựa thiến (theo dữ liệu đã lưu)' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Giới tính (nhập tay)')).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Tên ngựa *')); await userEvent.type(screen.getByLabelText('Tên ngựa *'), 'Thunder Bolt Updated');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu thông tin nhận dạng' }));
  await screen.findByRole('heading', { name: 'Thunder Bolt Updated' }, { timeout: 5000 });
  expect(readSamples().horseRegistry!.records[0].sex).toBe('GELDING');
});
it('saves a minimal draft without inventing missing identity values', async () => {
  open('/horses/new'); await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'Draft Arrival' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'DRAFT-009' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Draft Arrival' });
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'DRAFT-009')).toMatchObject({ lifecycle: 'DRAFT', breed: null, sex: null, foaledDate: null, activatedAt: null });
});
it('retains the actual custom breed rather than serializing the Other option', async () => {
  open('/horses/new'); await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'Custom Breed' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'CUSTOM-01' } });
  await userEvent.selectOptions(screen.getByLabelText('Giống ngựa'), '__CUSTOM__');
  fireEvent.change(screen.getByLabelText('Giống ngựa (nhập tay)'), { target: { value: 'Akhal-Teke' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Custom Breed' });
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'CUSTOM-01')?.breed).toBe('Akhal-Teke');
});
it('makes pending horses after the first page reachable', async () => {
  setBusinessActor(manager); await requestApi('/api/horses/7');
  const data = readSamples(), base = data.horseRegistry!.records[0];
  for (let index = 0; index < 51; index++) data.horseRegistry!.records.push({ ...structuredClone(base), id: 3000 + index, name: `Pending Horse ${index}`, horseCode: `P-${index}`, lifecycle: 'DRAFT', activatedAt: null });
  saveSamples(data); open('/horses/pending-activation');
  await screen.findByRole('heading', { name: 'Pending Horse 0 · P-0' });
  expect(screen.getByText(/· 51 con ngựa/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(await screen.findByRole('heading', { name: 'Pending Horse 50 · P-50' })).toBeInTheDocument();
  expect(screen.getByText('Trang 2/2')).toBeInTheDocument();
});
it.each(['GROOM', 'WORK_RIDER'] as const)('provides shared header account logout for %s without a role chooser', async (role) => {
  open(role === 'GROOM' ? '/groom/today' : '/rider', { ...manager, roles: [role] });
  await screen.findByRole('heading', { name: /^Chào buổi (sáng|chiều|tối), Test Manager$/ });
  fireEvent.click(screen.getByRole('button', { name: 'Menu tài khoản' }));
  await screen.findByRole('heading', { name: 'Tài khoản của tôi' });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull(); expect(getBusinessActor()).toBeNull();
});
it('declares optional racing strengths on registration and shows them on the profile', async () => {
  const router = open('/horses/new'); await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'Quick Step' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'STR-010' } });
  const distance = screen.getByRole('group', { name: 'Cự ly sở trường' });
  await userEvent.click(within(screen.getByRole('group', { name: 'Thể chất' })).getByLabelText('Tốc độ'));
  await userEvent.click(within(distance).getByLabelText('Nước rút'));
  await userEvent.click(within(distance).getByLabelText('Đường dài'));
  await userEvent.click(within(distance).getByLabelText('Đường dài'));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · Quick Step' });
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'STR-010')?.strengths).toEqual(['SPRINT', 'SPEED']);
  await router.navigate(`/horses/${router.state.location.pathname.split('/')[2]}`);
  expect(await screen.findByText('Nước rút · Tốc độ')).toBeInTheDocument();
});
