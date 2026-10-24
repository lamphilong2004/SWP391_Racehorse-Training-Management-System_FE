import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES, type RoleCode } from '../../shared/auth/roles';
import { failure, fixtureResponse, headTrainer } from './__tests__/httpFixtures';
import { createdProgram, template, validRequest } from './__tests__/fixtures';

type Actor = ReturnType<typeof userEvent.setup>;
type Override = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;
function setup({ role = 'HEAD_TRAINER', path = '/training/programs/new', override }: { role?: RoleCode; path?: string; override?: Override } = {}) {
  authSession.save('fixture-program-jwt', 3600, false);
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    return await override?.(url, init) ?? fixtureResponse(url, init, { ...headTrainer, roles: [role] });
  });
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  const posts = () => fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/api/training-programs') && init?.method === 'POST');
  return { actor: userEvent.setup({ delay: null }), fetchMock, router, posts };
}
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } }); }
async function next(actor: Actor) { await actor.click(screen.getByRole('button', { name: 'Tiếp tục' })); }
async function chooseTemplate(actor: Actor) {
  await actor.click(await screen.findByRole('radio', { name: /^Chọn Thunder Bolt \(/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled());
  await next(actor); await next(actor);
  await actor.click(await screen.findByRole('button', { name: 'Dùng mẫu gợi ý Race Preparation 1600m' }));
  await screen.findByLabelText('Phiên bản mẫu');
  await next(actor);
}
function customize() {
  change('Tên chương trình', 'Horse-specific program'); change('Mục tiêu huấn luyện', 'Build endurance');
  change('Ngày bắt đầu chương trình', '2026-11-01'); change('Ngày kết thúc chương trình', '2026-11-30');
  change('Chỉ số mục tiêu', 'Improve sustained gallop'); change('Ghi chú', 'Protect recovery');
  change('Giai đoạn 1 — ngày bắt đầu', '2026-11-01'); change('Giai đoạn 1 — ngày kết thúc', '2026-11-07');
  change('Giai đoạn 2 — ngày bắt đầu', '2026-11-08'); change('Giai đoạn 2 — ngày kết thúc', '2026-11-30');
}
async function toTrainer(actor: Actor) {
  await chooseTemplate(actor); customize(); await next(actor);
  await actor.selectOptions(screen.getByLabelText('Giai đoạn 1 — cường độ tối thiểu'), 'LOW');
  await actor.selectOptions(screen.getByLabelText('Giai đoạn 1 — cường độ tối đa'), 'MEDIUM');
  change('Giai đoạn 2 — khối lượng', 'Progress gradually'); await next(actor);
}
async function review(actor: Actor) {
  await toTrainer(actor);
  await actor.click(screen.getByRole('button', { name: 'Chọn Fixture Trainer' }));
  change('Trainer phụ trách từ ngày', '2026-11-01');
  await actor.click(screen.getByRole('checkbox', { name: 'Tôi đã đọc các cảnh báo về Trainer' }));
  await next(actor);
}
const submit = () => screen.getByRole('button', { name: 'Tạo và kích hoạt chương trình' });

describe('CORE-022 UI + production router + real transport with HTTP fixtures (not live BE)', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('lets Head Trainer enter from workspace, complete all steps, send a pinned DTO and read the saved result', async () => {
    const { actor, router, posts, fetchMock } = setup({ path: '/dashboard' });
    await actor.click(await screen.findByRole('link', { name: 'Tạo chương trình' }));
    expect(router.state.location.pathname).toBe('/training/programs/new');
    expect(await screen.findByRole('radio', { name: /^Chọn Locked Horse \(/ })).toBeDisabled();
    await review(actor);
    expect(screen.queryByLabelText(/Target race|Target date|preferred surface/i)).not.toBeInTheDocument();
    await actor.click(submit());
    expect(await screen.findByText('Mã chương trình: 1001')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/training/programs/new');
    expect(posts()).toHaveLength(1);
    const [, init] = posts()[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ horseId: 7, templateVersionId: 302, name: 'Horse-specific program', periodStart: '2026-11-01', periodEnd: '2026-11-30', trainer: validRequest().trainer });
    expect(body.phases[0]).toMatchObject({ templateVersionPhaseId: 31, phaseOrder: 1, intensityMin: 'LOW', intensityMax: 'MEDIUM' });
    expect(body.phases[1]).toMatchObject({ templateVersionPhaseId: 32, workload: 'Progress gradually' });
    expect(Object.keys(body)).toEqual(['horseId', 'templateVersionId', 'name', 'goals', 'targetMetrics', 'periodStart', 'periodEnd', 'notes', 'phases', 'trainer']);
    expect(JSON.stringify(body)).not.toMatch(/targetRace|targetDate|surface|"status"|"id"/i);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-program-jwt');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('http://localhost:8080/api/'))).toBe(true);
    expect(fetchMock.mock.calls.filter(([, options]) => ['PUT', 'PATCH'].includes(options?.method ?? ''))).toHaveLength(0);
    expect(template.version.phases[0].name).toBe('Foundation');
    await actor.click(screen.getByRole('button', { name: 'Tải lại chương trình đã lưu' }));
    expect(await screen.findByRole('heading', { name: 'Saved server program' })).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it.each(ROLE_CODES.filter((role) => role !== 'HEAD_TRAINER'))('blocks %s before loading feature data or creating a program', async (role) => {
    const { actor, fetchMock, posts } = setup({ role });
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/api/auth/me']);
    expect(posts()).toHaveLength(0);
    await actor.click(screen.getByRole('button', { name: 'Quay lại không gian làm việc' }));
    const accountMenu = await screen.findByRole('button', { name: 'Menu tài khoản' });
    expect(screen.queryByRole('link', { name: 'Tạo chương trình' })).not.toBeInTheDocument();
    await actor.click(accountMenu);
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    expect(authSession.read()?.accessToken).toBe('fixture-program-jwt');
  });

  it('clears dates, phase lineage and Trainer state when version/template/horse changes', async () => {
    const { actor, fetchMock, posts } = setup();
    await review(actor);
    await actor.click(screen.getByRole('button', { name: 'Mẫu chương trình' }));
    await actor.selectOptions(screen.getByLabelText('Phiên bản mẫu'), '3');
    await screen.findByLabelText('Phiên bản mẫu');
    await next(actor);
    expect(screen.getByLabelText('Ngày bắt đầu chương trình', { exact: false })).toHaveValue('');
    expect(screen.getByLabelText('Giai đoạn 1 — ngày bắt đầu', { exact: false })).toHaveValue('');
    expect(screen.getByText('Giai đoạn gốc: 41')).toBeInTheDocument();
    customize(); await next(actor); await next(actor);
    expect(screen.getByRole('button', { name: 'Chọn Fixture Trainer' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('checkbox', { name: 'Tôi đã đọc các cảnh báo về Trainer' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Trainer phụ trách từ ngày', { exact: false })).toHaveValue('');
    await actor.click(screen.getByRole('button', { name: 'Mẫu chương trình' }));
    await actor.click(screen.getByRole('button', { name: 'Dùng Recovery' }));
    await screen.findByLabelText('Phiên bản mẫu');
    await next(actor);
    expect(screen.getByLabelText('Ngày bắt đầu chương trình', { exact: false })).toHaveValue('');
    await actor.click(screen.getByRole('button', { name: 'Ngựa' }));
    await actor.click(screen.getByRole('radio', { name: /^Chọn Silver Star \(/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled());
    await next(actor); await next(actor);
    expect(screen.queryByLabelText('Phiên bản mẫu')).not.toBeInTheDocument();
    await next(actor);
    expect(screen.getAllByText('Hãy chọn một phiên bản mẫu đang hoạt động.').length).toBeGreaterThan(0);
    expect(posts()).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('templateVersionId=303'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('templateVersionId=403'))).toBe(true);
  });

  it('blocks invalid phase dates/intensity and unacknowledged Trainer warnings before POST', async () => {
    const { actor, posts } = setup();
    await chooseTemplate(actor); customize(); change('Giai đoạn 2 — ngày bắt đầu', '2026-11-07');
    await next(actor);
    expect(screen.getByLabelText('Giai đoạn 2 — ngày bắt đầu', { exact: false })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Thời gian các giai đoạn không được chồng lấn.').length).toBeGreaterThan(0);
    change('Giai đoạn 2 — ngày bắt đầu', '2026-11-08'); await next(actor);
    await actor.selectOptions(screen.getByLabelText('Giai đoạn 1 — cường độ tối thiểu'), 'HIGH');
    await actor.selectOptions(screen.getByLabelText('Giai đoạn 1 — cường độ tối đa'), 'LOW'); await next(actor);
    expect(screen.getByLabelText('Giai đoạn 1 — cường độ tối đa')).toHaveAttribute('aria-invalid', 'true');
    await actor.selectOptions(screen.getByLabelText('Giai đoạn 1 — cường độ tối đa'), 'HIGH'); await next(actor);
    await actor.click(screen.getByRole('button', { name: 'Chọn Fixture Trainer' }));
    change('Trainer phụ trách từ ngày', '2026-11-01'); await next(actor);
    expect(screen.getByRole('checkbox', { name: 'Tôi đã đọc các cảnh báo về Trainer' })).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toHaveLength(0);
    await actor.click(screen.getByRole('checkbox', { name: 'Tôi đã đọc các cảnh báo về Trainer' })); await next(actor);
    expect(submit()).toBeEnabled();
  });

  it('ignores an old template response after switching horse through the wizard', async () => {
    let finish!: (response: Response) => void;
    const { actor, fetchMock, posts } = setup({ override: (url, init) => url.pathname === '/api/program-templates/3'
      ? new Promise((resolve) => { finish = resolve; }) : fixtureResponse(url, init) });
    await actor.click(await screen.findByRole('radio', { name: /^Chọn Thunder Bolt \(/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled());
    await next(actor); await next(actor);
    await actor.click(screen.getByRole('button', { name: 'Dùng mẫu gợi ý Race Preparation 1600m' }));
    await actor.click(screen.getByRole('button', { name: 'Ngựa' }));
    await actor.click(screen.getByRole('radio', { name: /^Chọn Silver Star \(/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled());
    finish(fixtureResponse(new URL('http://localhost:8080/api/program-templates/3?versionNo=2')));
    await next(actor); await next(actor);
    expect(screen.queryByLabelText('Phiên bản mẫu')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/trainer-recommendations'))).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it('prevents duplicate create while pending and after success', async () => {
    let finish!: (response: Response) => void;
    const { actor, posts } = setup({ override: (url, init) => url.pathname === '/api/training-programs' && init?.method === 'POST' ? new Promise((resolve) => { finish = resolve; }) : undefined });
    await review(actor);
    const form = screen.getByRole('form', { name: 'Tạo chương trình huấn luyện' });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Đang tạo chương trình…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeDisabled();
    finish(new Response(JSON.stringify({ success: true, data: createdProgram }), { status: 201 }));
    await screen.findByText('Mã chương trình: 1001');
    const activationTime = document.querySelector(`time[datetime="${createdProgram.activatedAt}"]`);
    expect(activationTime).toBeInTheDocument();
    expect(activationTime).toHaveTextContent(/\d{2}\/\d{2}\/2026 · \d{2}:\d{2}/);
    expect(screen.queryByText(createdProgram.activatedAt)).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); expect(posts()).toHaveLength(1);
  });

  it('maps 400 field details back to controls, preserves the draft and retries corrected data', async () => {
    let attempts = 0;
    const { actor, posts } = setup({ override: (url, init) => {
      if (url.pathname === '/api/training-programs' && init?.method === 'POST' && ++attempts === 1) return failure(400, 'VALIDATION_ERROR', 'Check program fields.', [{ field: 'phases.0.name', message: 'Use a distinct phase name.' }]);
    } });
    await review(actor); await actor.click(submit());
    const input = await screen.findByLabelText('Giai đoạn 1 — tên', { exact: false });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Tên chương trình', { exact: false })).toHaveValue('Horse-specific program');
    change('Giai đoạn 1 — tên', 'Adjusted foundation'); await next(actor); await next(actor); await next(actor);
    await actor.click(submit()); await screen.findByText('Mã chương trình: 1001');
    expect(JSON.parse(String(posts()[1][1]?.body)).phases[0].name).toBe('Adjusted foundation');
  });

  it.each(['conflict', 'network', 'forbidden'] as const)('preserves draft and session on %s and permits retry', async (kind) => {
    let attempts = 0;
    const message = kind === 'conflict' ? 'Horse is LOCKED: rest required by Veterinarian.' : kind === 'forbidden' ? 'You do not have permission to perform this action.' : 'Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.';
    const { actor, posts } = setup({ override: (url, init) => {
      if (url.pathname === '/api/training-programs' && init?.method === 'POST' && ++attempts === 1) {
        if (kind === 'network') throw new TypeError('Fixture connection failed');
        return failure(kind === 'conflict' ? 409 : 403, kind === 'conflict' ? 'BUSINESS_RULE_VIOLATION' : 'FORBIDDEN', message,
          kind === 'conflict' ? [{ field: 'horseId', message: 'Veterinarian restriction: no training until cleared.' }] : []);
      }
    } });
    await review(actor); await actor.click(submit());
    expect(await screen.findByText(message)).toBeInTheDocument();
    if (kind === 'conflict') expect(screen.getByText('Veterinarian restriction: no training until cleared.')).toBeInTheDocument();
    expect(authSession.read()?.accessToken).toBe('fixture-program-jwt');
    expect(screen.getByText('Horse-specific program')).toBeInTheDocument();
    expect(screen.queryByText('Đã tạo chương trình')).not.toBeInTheDocument();
    await actor.click(submit()); await screen.findByText('Mã chương trình: 1001');
    expect(posts()).toHaveLength(2);
    expect(posts()[0][1]?.body).toBe(posts()[1][1]?.body);
  });

  it.each([401, 403])('uses canonical session handling for %s expired/inactive protected requests', async (status) => {
    const { posts, router } = setup({ override: (url) => url.pathname === '/api/horses'
      ? failure(status, status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', status === 401 ? 'Token expired.' : 'Your account is deactivated.') : undefined });
    expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login'); expect(authSession.read()).toBeNull(); expect(posts()).toHaveLength(0);
  });
});
