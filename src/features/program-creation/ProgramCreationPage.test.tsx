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
async function next(actor: Actor) { await actor.click(screen.getByRole('button', { name: 'Continue' })); }
async function chooseTemplate(actor: Actor) {
  await actor.click(await screen.findByRole('radio', { name: 'Select Thunder Bolt' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  await next(actor); await next(actor);
  await actor.click(await screen.findByRole('button', { name: 'Use recommended Race Preparation 1600m' }));
  await screen.findByLabelText('Template version');
  await next(actor);
}
function customize() {
  change('Program name', 'Horse-specific program'); change('Goals', 'Build endurance');
  change('Program start date', '2026-11-01'); change('Program end date', '2026-11-30');
  change('Target metrics', 'Improve sustained gallop'); change('Notes', 'Protect recovery');
  change('Phase 1 start date', '2026-11-01'); change('Phase 1 end date', '2026-11-07');
  change('Phase 2 start date', '2026-11-08'); change('Phase 2 end date', '2026-11-30');
}
async function toTrainer(actor: Actor) {
  await chooseTemplate(actor); customize(); await next(actor);
  await actor.selectOptions(screen.getByLabelText('Phase 1 minimum intensity'), 'LOW');
  await actor.selectOptions(screen.getByLabelText('Phase 1 maximum intensity'), 'MEDIUM');
  change('Phase 2 workload', 'Progress gradually'); await next(actor);
}
async function review(actor: Actor) {
  await toTrainer(actor);
  await actor.click(screen.getByRole('button', { name: 'Select Fixture Trainer' }));
  change('Trainer effective from', '2026-11-01');
  await actor.click(screen.getByRole('checkbox', { name: 'I acknowledge the Trainer warnings' }));
  await next(actor);
}
const submit = () => screen.getByRole('button', { name: 'Create and activate program' });

describe('CORE-022 UI + production router + real transport with HTTP fixtures (not live BE)', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('lets Head Trainer enter from workspace, complete all steps, send a pinned DTO and read the saved result', async () => {
    const { actor, router, posts, fetchMock } = setup({ path: '/dashboard' });
    await actor.click(await screen.findByRole('link', { name: 'Create program' }));
    expect(router.state.location.pathname).toBe('/training/programs/new');
    expect(await screen.findByRole('radio', { name: 'Select Locked Horse' })).toBeDisabled();
    await review(actor);
    expect(screen.queryByLabelText(/Target race|Target date|preferred surface/i)).not.toBeInTheDocument();
    await actor.click(submit());
    expect(await screen.findByText('Program ID: 1001')).toBeInTheDocument();
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
    await actor.click(screen.getByRole('button', { name: 'Reload saved program' }));
    expect(await screen.findByRole('heading', { name: 'Saved server program' })).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it.each(ROLE_CODES.filter((role) => role !== 'HEAD_TRAINER'))('blocks %s before loading feature data or creating a program', async (role) => {
    const { actor, fetchMock, posts } = setup({ role });
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/api/auth/me']);
    expect(posts()).toHaveLength(0);
    await actor.click(screen.getByRole('button', { name: 'Back to workspace' }));
    const accountMenu = await screen.findByRole('button', { name: 'Account menu' });
    expect(screen.queryByRole('link', { name: 'Create program' })).not.toBeInTheDocument();
    await actor.click(accountMenu);
    expect(await screen.findByRole('heading', { name: 'My Account' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(authSession.read()?.accessToken).toBe('fixture-program-jwt');
  });

  it('clears dates, phase lineage and Trainer state when version/template/horse changes', async () => {
    const { actor, fetchMock, posts } = setup();
    await review(actor);
    await actor.click(screen.getByRole('button', { name: 'Template' }));
    await actor.selectOptions(screen.getByLabelText('Template version'), '3');
    await screen.findByLabelText('Template version');
    await next(actor);
    expect(screen.getByLabelText('Program start date', { exact: false })).toHaveValue('');
    expect(screen.getByLabelText('Phase 1 start date', { exact: false })).toHaveValue('');
    expect(screen.getByText('Source phase: 41')).toBeInTheDocument();
    customize(); await next(actor); await next(actor);
    expect(screen.getByRole('button', { name: 'Select Fixture Trainer' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('checkbox', { name: 'I acknowledge the Trainer warnings' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Trainer effective from', { exact: false })).toHaveValue('');
    await actor.click(screen.getByRole('button', { name: 'Template' }));
    await actor.click(screen.getByRole('button', { name: 'Use Recovery' }));
    await screen.findByLabelText('Template version');
    await next(actor);
    expect(screen.getByLabelText('Program start date', { exact: false })).toHaveValue('');
    await actor.click(screen.getByRole('button', { name: 'Horse' }));
    await actor.click(screen.getByRole('radio', { name: 'Select Silver Star' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    await next(actor); await next(actor);
    expect(screen.queryByLabelText('Template version')).not.toBeInTheDocument();
    await next(actor);
    expect(screen.getAllByText('Select an ACTIVE template version.').length).toBeGreaterThan(0);
    expect(posts()).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('templateVersionId=303'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('templateVersionId=403'))).toBe(true);
  });

  it('blocks invalid phase dates/intensity and unacknowledged Trainer warnings before POST', async () => {
    const { actor, posts } = setup();
    await chooseTemplate(actor); customize(); change('Phase 2 start date', '2026-11-07');
    await next(actor);
    expect(screen.getByLabelText('Phase 2 start date', { exact: false })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Phase date ranges must not overlap.').length).toBeGreaterThan(0);
    change('Phase 2 start date', '2026-11-08'); await next(actor);
    await actor.selectOptions(screen.getByLabelText('Phase 1 minimum intensity'), 'HIGH');
    await actor.selectOptions(screen.getByLabelText('Phase 1 maximum intensity'), 'LOW'); await next(actor);
    expect(screen.getByLabelText('Phase 1 maximum intensity')).toHaveAttribute('aria-invalid', 'true');
    await actor.selectOptions(screen.getByLabelText('Phase 1 maximum intensity'), 'HIGH'); await next(actor);
    await actor.click(screen.getByRole('button', { name: 'Select Fixture Trainer' }));
    change('Trainer effective from', '2026-11-01'); await next(actor);
    expect(screen.getByRole('checkbox', { name: 'I acknowledge the Trainer warnings' })).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toHaveLength(0);
    await actor.click(screen.getByRole('checkbox', { name: 'I acknowledge the Trainer warnings' })); await next(actor);
    expect(submit()).toBeEnabled();
  });

  it('ignores an old template response after switching horse through the wizard', async () => {
    let finish!: (response: Response) => void;
    const { actor, fetchMock, posts } = setup({ override: (url, init) => url.pathname === '/api/program-templates/3'
      ? new Promise((resolve) => { finish = resolve; }) : fixtureResponse(url, init) });
    await actor.click(await screen.findByRole('radio', { name: 'Select Thunder Bolt' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    await next(actor); await next(actor);
    await actor.click(screen.getByRole('button', { name: 'Use recommended Race Preparation 1600m' }));
    await actor.click(screen.getByRole('button', { name: 'Horse' }));
    await actor.click(screen.getByRole('radio', { name: 'Select Silver Star' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    finish(fixtureResponse(new URL('http://localhost:8080/api/program-templates/3?versionNo=2')));
    await next(actor); await next(actor);
    expect(screen.queryByLabelText('Template version')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/trainer-recommendations'))).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it('prevents duplicate create while pending and after success', async () => {
    let finish!: (response: Response) => void;
    const { actor, posts } = setup({ override: (url, init) => url.pathname === '/api/training-programs' && init?.method === 'POST' ? new Promise((resolve) => { finish = resolve; }) : undefined });
    await review(actor);
    const form = screen.getByRole('form', { name: 'Create training program' });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Creating program…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    finish(new Response(JSON.stringify({ success: true, data: createdProgram }), { status: 201 }));
    await screen.findByText('Program ID: 1001');
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); expect(posts()).toHaveLength(1);
  });

  it('maps 400 field details back to controls, preserves the draft and retries corrected data', async () => {
    let attempts = 0;
    const { actor, posts } = setup({ override: (url, init) => {
      if (url.pathname === '/api/training-programs' && init?.method === 'POST' && ++attempts === 1) return failure(400, 'VALIDATION_ERROR', 'Check program fields.', [{ field: 'phases.0.name', message: 'Use a distinct phase name.' }]);
    } });
    await review(actor); await actor.click(submit());
    const input = await screen.findByLabelText('Phase 1 name', { exact: false });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Program name', { exact: false })).toHaveValue('Horse-specific program');
    change('Phase 1 name', 'Adjusted foundation'); await next(actor); await next(actor); await next(actor);
    await actor.click(submit()); await screen.findByText('Program ID: 1001');
    expect(JSON.parse(String(posts()[1][1]?.body)).phases[0].name).toBe('Adjusted foundation');
  });

  it.each(['conflict', 'network', 'forbidden'] as const)('preserves draft and session on %s and permits retry', async (kind) => {
    let attempts = 0;
    const message = kind === 'conflict' ? 'Horse is LOCKED: rest required by Veterinarian.' : kind === 'forbidden' ? 'You do not have permission to perform this action.' : 'Cannot reach the server. Check your connection and try again.';
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
    expect(screen.queryByText('Program created')).not.toBeInTheDocument();
    await actor.click(submit()); await screen.findByText('Program ID: 1001');
    expect(posts()).toHaveLength(2);
    expect(posts()[0][1]?.body).toBe(posts()[1][1]?.body);
  });

  it.each([401, 403])('uses canonical session handling for %s expired/inactive protected requests', async (status) => {
    const { posts, router } = setup({ override: (url) => url.pathname === '/api/horses'
      ? failure(status, status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', status === 401 ? 'Token expired.' : 'Your account is deactivated.') : undefined });
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login'); expect(authSession.read()).toBeNull(); expect(posts()).toHaveLength(0);
  });
});
