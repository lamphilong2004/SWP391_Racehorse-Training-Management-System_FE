import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { configureCore046AccessTokenProvider } from './session';

afterEach(() => { configureCore046AccessTokenProvider(null); vi.unstubAllGlobals(); });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
function visit(path: string) { render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />); }

describe('CORE-046 pages', () => {
  it('shows assigned Groom tasks, completes with empty body and reloads server state', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    let completed = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/me')) return ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' });
      if (url.includes('/api/groom/treatment-tasks/7/complete')) { completed = true; expect(init).toMatchObject({ method: 'POST', body: '{}' }); return ok({ id: 7, status: 'COMPLETED' }); }
      if (url.includes('/api/groom/treatment-tasks?')) return ok({ items: [{ id: 7, horseId: 3, assignedGroomUserId: 5, instruction: 'Check left forelimb', taskDate: '2020-01-01', status: completed ? 'COMPLETED' : 'PENDING', ...(completed ? { completedAt: '2026-10-16T01:00:00.000Z' } : {}) }], page: 0, size: 100, totalElements: 1 });
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByText('Check left forelimb')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(await screen.findByText('No treatment tasks')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Completed/ }));
    expect(await screen.findByText(/✓ Completed/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Horse #3 treatment tasks' })).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/api/groom/treatment-tasks?'))).toHaveLength(2);
  });

  it('shows the assigned task empty state', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : ok({ items: [], page: 0, size: 100, totalElements: 0 })));
    visit('/medical/my-tasks');
    expect(await screen.findByText('No treatment tasks')).toBeInTheDocument();
  });

  it('reports an incident explicitly from a Groom task with its horse and care-task context', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/me')) return ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' });
      if (url.includes('/api/groom/treatment-tasks?')) return ok({ items: [
        { id: 7, horseId: 3, assignedGroomUserId: 5, instruction: 'Check left forelimb', taskDate: '2020-01-01', status: 'PENDING' },
        { id: 8, horseId: 4, assignedGroomUserId: 5, instruction: 'Check right hindlimb', taskDate: '2020-01-01', status: 'PENDING' },
      ], page: 0, size: 100, totalElements: 2 });
      if (url.endsWith('/api/incidents')) return new Response(JSON.stringify({ success: true, data: { id: 901, incidentCode: 'INC-901' } }), { status: 201 });
      throw new Error(`Unexpected URL ${url} ${init?.method}`);
    });
    vi.stubGlobal('fetch', fetcher);
    visit('/medical/my-tasks');
    expect(await screen.findByText('Check left forelimb')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/incidents'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Report Incident for task 7 on horse 3' }));
    expect(screen.getByLabelText('Horse *')).toBeDisabled();
    expect(screen.getByText(/From treatment task #7/)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('group', { name: 'Incident type' })).getByRole('button', { name: 'Fever' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Observed severity' })).getByRole('button', { name: 'High' }));
    await userEvent.type(screen.getByLabelText('Description *'), 'Fever after care');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Incident' }));
    const post = fetcher.mock.calls.find(([url]) => String(url).endsWith('/api/incidents'));
    expect(post?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ horseId: 3, careTaskId: 7, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: expect.any(String), description: 'Fever after care' });
    expect(await screen.findByText('Incident INC-901 submitted.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the task-scoped Groom modal open on an incident POST conflict', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/auth/me')) return ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' });
      if (url.includes('/api/groom/treatment-tasks?')) return ok({ items: [{ id: 7, horseId: 3, assignedGroomUserId: 5, instruction: 'Check left forelimb', taskDate: '2020-01-01', status: 'PENDING' }], page: 0, size: 100, totalElements: 1 });
      return new Response(JSON.stringify({ success: false, error: { message: 'Incident conflict' } }), { status: 409 });
    }));
    visit('/medical/my-tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Report Incident for task 7 on horse 3' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Incident type' })).getByRole('button', { name: 'Fever' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Observed severity' })).getByRole('button', { name: 'High' }));
    await userEvent.type(screen.getByLabelText('Description *'), 'Fever after care');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Incident' }));
    expect(await screen.findByText('Incident conflict')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Description *')).toHaveValue('Fever after care');
    expect(screen.queryByText(/submitted\./)).not.toBeInTheDocument();
  });

  it('keeps a task pending and surfaces a completion conflict', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/auth/me')) return ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' });
      if (url.includes('/complete')) return new Response(JSON.stringify({ success: false, error: { message: 'Task already completed' } }), { status: 409 });
      return ok({ items: [{ id: 7, horseId: 3, assignedGroomUserId: 5, instruction: 'Check left forelimb', taskDate: '2020-01-01', status: 'PENDING' }], page: 0, size: 100, totalElements: 1 });
    }));
    visit('/medical/my-tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }));
    expect(await screen.findByText('Task already completed')).toBeInTheDocument();
    expect(screen.getByText('Check left forelimb')).toBeInTheDocument();
  });

  it('shows a forbidden incident list response without leaking rows', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : new Response(JSON.stringify({ success: false, error: { message: 'Forbidden incident scope' } }), { status: 403 })));
    visit('/incidents');
    expect(await screen.findByText('You do not have access to this data.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a session-expired state when incident loading returns 401', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : new Response(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }), { status: 401 })));
    visit('/incidents');
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument();
  });

  it('shows the incident list empty state from an empty server-scoped page', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : ok({ items: [], page: 0, size: 100, totalElements: 0 })));
    visit('/incidents');
    expect(await screen.findByText('No incidents')).toBeInTheDocument();
  });

  it('keeps a successful incident submission successful when the list refresh fails', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    let posted = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/me')) return ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' });
      if (url.endsWith('/api/incidents') && init?.method === 'POST') {
        posted = true;
        return new Response(JSON.stringify({ success: true, data: { id: 901, incidentCode: 'INC-901' } }), { status: 201 });
      }
      if (url.includes('/api/incidents?')) {
        if (posted) throw new Error('Network unavailable');
        return ok({ items: [{ id: 1, incidentCode: 'INC-001', horseId: 3, reportedByUserId: 5, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: new Date().toISOString(), reportedAt: new Date().toISOString(), status: 'REPORTED' }], page: 0, size: 100, totalElements: 1 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    visit('/incidents');
    expect(await screen.findByText('INC-001')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Report Incident' }));
    await userEvent.selectOptions(screen.getByLabelText('Horse *'), '3');
    await userEvent.click(within(screen.getByRole('group', { name: 'Incident type' })).getByRole('button', { name: 'Fever' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Observed severity' })).getByRole('button', { name: 'High' }));
    await userEvent.type(screen.getByLabelText('Description *'), 'Fever observed');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Incident' }));
    expect(await screen.findByText('Incident INC-901 submitted.')).toBeInTheDocument();
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/api/incidents') && init?.method === 'POST')).toHaveLength(1);
  });

  it('filters only incident rows returned for the signed-in reporter', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    const reportedAt = new Date().toISOString();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : ok({ items: [
        { id: 1, incidentCode: 'INC-001', horseId: 3, reportedByUserId: 5, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: reportedAt, reportedAt, status: 'REPORTED' },
        { id: 2, incidentCode: 'INC-002', horseId: 4, reportedByUserId: 5, incidentType: 'OFF_FEED', observedSeverity: 'LOW', observedAt: reportedAt, reportedAt, status: 'RESOLVED' },
      ], page: 0, size: 100, totalElements: 2 })));
    visit('/incidents');
    expect(await screen.findByText('INC-001')).toBeInTheDocument();
    expect(screen.getByText('INC-002')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'INC-002');
    expect(screen.queryByText('INC-001')).not.toBeInTheDocument();
    expect(screen.getByText('INC-002')).toBeInTheDocument();
  });

  it('renders reporter-safe incident detail without Vet review actions', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me') ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' }) : ok({ id: 12, incidentCode: 'INC-012', horseId: 3, reportedByUserId: 5, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: '2026-10-16T01:00:00.000Z', reportedAt: '2026-10-16T01:05:00.000Z', status: 'REPORTED', description: 'Temperature high' })));
    visit('/incidents/12');
    expect(await screen.findByText('Incident INC-012')).toBeInTheDocument();
    expect(screen.getByText('Temperature high')).toBeInTheDocument();
    expect(screen.getByText('Unavailable until the incident photo API is approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Under Review|Resolve Incident/ })).not.toBeInTheDocument();
  });

  it('shows an incident detail error when the server returns 404', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/auth/me')
      ? ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' })
      : new Response(JSON.stringify({ success: false, error: { message: 'Incident not found' } }), { status: 404 })));
    visit('/incidents/12');
    expect(await screen.findByText('Incident not found')).toBeInTheDocument();
  });

  it('rejects an invalid detail ID before requesting incident data', async () => {
    configureCore046AccessTokenProvider(() => 'jwt');
    const fetcher = vi.fn(async () => ok({ id: 5, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' }));
    vi.stubGlobal('fetch', fetcher);
    visit('/incidents/not-an-id');
    expect(await screen.findByText('Invalid incident ID')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
