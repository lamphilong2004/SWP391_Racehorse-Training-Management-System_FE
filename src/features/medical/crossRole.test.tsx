import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { CurrentUser } from '../../shared/auth/authApi';
import type { MedicalCase } from './models';

// Author-only HTTP fixtures exercise actual providers, routes and adapters. No Backend/SQL proof.
it('Vet assigns treatment -> normal Groom login completes -> Vet rereads progress and records recovery', async () => {
  const vet: CurrentUser = { id: 7, fullName: 'Vet', email: 'vet@example.test', userCode: 'V7', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' };
  const groom: CurrentUser = { ...vet, id: 6, fullName: 'Groom', roles: ['GROOM'] };
  let actor = vet;
  const record: MedicalCase = { id: 9, horseId: 14, status: 'OPEN', reason: 'Lameness', openedAt: '2026-10-19T00:00:00Z', incidentIds: [], examinations: [], injuries: [], reexaminations: [] };
  let tasks: Record<string, unknown>[] = [];
  const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
  const page = () => ({ items: tasks, page: 0, size: 20, totalElements: tasks.length });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname, body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path.endsWith('/auth/me')) return ok(actor);
    if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    if (path.endsWith('/auth/login')) {
      actor = body.email === groom.email ? groom : vet;
      // Distinct emails below select the real shared login path in the fixture.
      return ok({ accessToken: `fixture-${actor.id}`, tokenType: 'Bearer', expiresIn: 3600, user: actor });
    }
    if (path === '/api/medical/cases/9') return ok(record);
    if (path === '/api/horses/14/training-availability') return ok({ horseId: 14, availability: 'LIMITED', reason: 'Operational exercise limits' });
    if (path.endsWith('/examinations')) {
      const exam = { id: 1, caseId: 9, horseId: 14, ...body }; record.examinations.push(exam); return ok(exam);
    }
    if (path.endsWith('/injuries')) {
      const injury = { id: 1, caseId: 9, ...body }; record.injuries.push(injury); return ok(injury);
    }
    if (path.endsWith('/treatment-plan')) {
      record.treatmentPlan = { id: 3, caseId: 9, createdAt: '2026-10-19T01:00:00Z', treatmentMedicationInstructions: body.treatmentMedicationInstructions };
      tasks = body.groomTasks.map((t: Record<string, unknown>, i: number) => ({ ...t, id: i + 1, caseId: 9, treatmentPlanId: 3, horseId: 14, status: 'PENDING' }));
      return ok(record.treatmentPlan);
    }
    if (path === '/api/medical/cases/9/treatment-tasks') return ok(page());
    if (path === '/api/groom/treatment-tasks') return ok({ ...page(), size: 100, items: tasks.map(({ id, horseId, assignedGroomUserId, instruction, taskDate, status, completedAt }) => ({ id, horseId, assignedGroomUserId, instruction, taskDate, status, completedAt })) });
    if (path === '/api/groom/treatment-tasks/1/complete') {
      expect(body).toEqual({});
      expect(actor.id).toBe(6);
      tasks[0] = { ...tasks[0], status: 'COMPLETED', completedAt: '2026-10-19T02:00:00Z', completedByUserId: actor.id };
      const { id, horseId, assignedGroomUserId, instruction, taskDate, status, completedAt } = tasks[0];
      return ok({ id, horseId, assignedGroomUserId, instruction, taskDate, status, completedAt });
    }
    if (path.endsWith('/re-examinations')) {
      const exam = { id: 2, caseId: 9, horseId: 14, ...body }; record.reexaminations.push(exam); return ok(exam);
    }
    throw new Error(`Unexpected fixture path ${path}`);
  });
  groom.email = 'groom@example.test';
  vi.stubGlobal('fetch', fetcher);
  authSession.save('fixture-vet', 3600, false);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: ['/medical/cases/9'] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  async function section(name: string) { fireEvent.click(await screen.findByRole('tab', { name })); }
  await section('Khám');
  fireEvent.change(screen.getByLabelText('Triệu chứng và phát hiện'), { target: { value: 'Lame after exercise' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lần khám' }));
  await screen.findByText('Lame after exercise');
  await section('Chấn thương');
  fireEvent.change(screen.getByLabelText('Vùng cơ thể'), { target: { value: 'Chân trước trái' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Mức độ' }), { target: { value: 'MODERATE' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Tình trạng hồi phục' }), { target: { value: 'NOT_RECOVERED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu chấn thương' }));
  await screen.findByText(/Chân trước trái · Vừa/);
  await act(() => router.navigate('/medical/cases/9/treatment-plan'));
  fireEvent.change(await screen.findByRole('textbox', { name: /Hướng dẫn điều trị và dùng thuốc/ }), { target: { value: 'Private veterinary protocol' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm công việc cho Groom' }));
  fireEvent.change(screen.getByLabelText('Mã Groom 1'), { target: { value: '6' } });
  fireEvent.change(screen.getByLabelText('Hướng dẫn cho Groom 1'), { target: { value: 'Cold compress' } });
  fireEvent.change(screen.getByLabelText('Ngày thực hiện 1'), { target: { value: '2026-10-19' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu phác đồ điều trị' }));
  await screen.findByText('Đã lưu phác đồ điều trị');
  async function login(user: CurrentUser) {
    await act(() => router.navigate('/account'));
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'fixture-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await screen.findByRole('button', { name: 'Menu tài khoản' });
  }
  await login(groom);
  fireEvent.click(await screen.findByRole('link', { name: 'Công việc chăm sóc' }));
  expect(router.state.location.pathname).toBe('/care/tasks');
  fireEvent.click(await screen.findByRole('button', { name: 'Tất cả được giao' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Hoàn thành công việc 1' }));
  await screen.findByText(/Đã hoàn thành công việc 1/);
  expect(screen.queryByText('Private veterinary protocol')).not.toBeInTheDocument();
  await login(vet);
  await act(() => router.navigate('/medical/cases/9'));
  await section('Điều trị');
  expect(await screen.findByText(/Groom 6 · Hoàn thành/)).toBeInTheDocument();
  await section('Tái khám');
  fireEvent.change(screen.getByRole('combobox', { name: 'Tình trạng hồi phục' }), { target: { value: 'RECOVERED' } });
  fireEvent.change(screen.getByLabelText('Kết quả khám'), { target: { value: 'Normal gait at follow-up' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lần tái khám' }));
  await screen.findByText('Normal gait at follow-up');
  expect(record.reexaminations.at(-1)?.recoveryStatus).toBe('RECOVERED');
});
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });
