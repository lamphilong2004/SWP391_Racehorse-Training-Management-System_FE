import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { ApiError, type AuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES, type RoleCode } from '../../shared/auth/roles';
import { AuditLogPage } from './AuditLogPage';
import { ClubManagerDashboardPage } from './ClubManagerDashboardPage';
import { ManagementProvider } from './ManagementProvider';
import { ClubManagerDashboardEntry, core052AuditRoute } from './routes';
import { auditEntry, auditPageFixture, dashboardFixture } from './management.fixtures';
import type { AuditPage, ManagementService } from './types';

const manager: CurrentUser = { id: 12, userCode: 'U-012', fullName: 'Manager Test', email: 'manager@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };

function mount({ path = '/dashboard', roles = ['CLUB_MANAGER'], service, signedIn = true }: { path?: string; roles?: RoleCode[]; service?: ManagementService; signedIn?: boolean } = {}) {
  localStorage.clear(); sessionStorage.clear();
  if (signedIn) authSession.save('test-only-session', 3600, false);
  const api: AuthApi = { currentUser: vi.fn().mockResolvedValue({ ...manager, roles }), login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
  const selected = service ?? { dashboard: vi.fn().mockResolvedValue(dashboardFixture), audit: vi.fn().mockResolvedValue(auditPageFixture) };
  const router = createMemoryRouter([
    { path: '/dashboard', element: <ClubManagerDashboardEntry /> },
    core052AuditRoute,
    { path: '/direct-dashboard', element: <ClubManagerDashboardPage /> },
    { path: '/direct-audit', element: <AuditLogPage /> },
    { path: '/login', element: <h1>Sign in required</h1> },
  ], { initialEntries: [path] });
  render(<AuthProvider api={api}><ManagementProvider service={selected}><RouterProvider router={router} /></ManagementProvider></AuthProvider>);
  return { router, service: selected, api };
}

afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe('CORE-052 role and session integration', () => {
  it.each(ROLE_CODES.filter((role) => role !== 'CLUB_MANAGER'))('denies both management screens to %s before requesting data', async (role) => {
    const first = mount({ path: '/direct-audit', roles: [role] });
    expect(await screen.findByText('This page is available to Club Managers only.')).toBeInTheDocument();
    await act(() => first.router.navigate('/direct-dashboard'));
    expect(await screen.findByText('This page is available to Club Managers only.')).toBeInTheDocument();
    expect(first.service.dashboard).not.toHaveBeenCalled();
    expect(first.service.audit).not.toHaveBeenCalled();
  });

  it('accepts a multi-role manager without using the first role as authorization', async () => {
    const { service } = mount({ roles: ['GROOM', 'CLUB_MANAGER'] });
    expect(await screen.findByRole('heading', { name: 'Club Manager Dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(service.dashboard).toHaveBeenCalledOnce());
  });

  it('preserves another role workspace through the dashboard integration entry', async () => {
    const { service } = mount({ roles: ['VETERINARIAN'] });
    expect(await screen.findByRole('heading', { name: 'Veterinary Workspace' })).toBeInTheDocument();
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it('redirects anonymous direct links to shared sign-in without requesting management data', async () => {
    const { service, router } = mount({ path: '/admin/audit-log', signedIn: false });
    expect(await screen.findByRole('heading', { name: 'Sign in required' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(service.audit).not.toHaveBeenCalled();
  });

  it.each([
    new ApiError(401, 'UNAUTHORIZED', 'Expired'),
    new ApiError(403, 'FORBIDDEN', 'Your account is deactivated.'),
  ])('delegates session failures to shared authentication (%s)', async (error) => {
    const service = { dashboard: vi.fn().mockRejectedValue(error), audit: vi.fn() };
    mount({ service });
    expect(await screen.findByRole('heading', { name: 'Sign in required' })).toBeInTheDocument();
    expect(authSession.read()).toBeNull();
  });

  it('keeps an active session on ordinary role denial and does not offer a pointless retry', async () => {
    mount({ service: { dashboard: vi.fn().mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Role denied.')), audit: vi.fn() } });
    expect(await screen.findByText('Your account cannot access this management data.')).toBeInTheDocument();
    expect(authSession.read()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('signs out using shared authentication', async () => {
    const { api } = mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in required' })).toBeInTheDocument();
    expect(api.logout).toHaveBeenCalledWith('test-only-session');
    expect(authSession.read()).toBeNull();
  });
});

describe('CORE-052 dashboard', () => {
  it('shows contract-backed management widgets and opens the audit viewer', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { router } = mount();
    expect(await screen.findByText('9 / 18')).toBeInTheDocument();
    expect(screen.getByText('8 active · 1 draft · 0 inactive')).toBeInTheDocument();
    expect(screen.getByText('12 active · 1 inactive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Training today' })).toBeInTheDocument();
    expect(screen.queryByText(/Deworming due|Re-exams overdue|Revenue|Inventory value/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'View Audit Log' }));
    expect(await screen.findByRole('heading', { name: /Audit Log/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/audit-log');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('renders zero counts and honest empty states rather than seeded numbers', async () => {
    const empty = { horsesByLifecycle: [], horsesByAvailability: [], boxOccupancy: { total: 0, occupied: 0, free: 0 }, accountsByStatus: [], needsAttention: { pendingActivations: 0, pendingRegistrations: 0 }, trainingToday: { byStatus: [] }, openIncidents: 0, recentAudit: [] };
    mount({ service: { dashboard: vi.fn().mockResolvedValue(empty), audit: vi.fn() } });
    expect(await screen.findByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText('No horses registered')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
    expect(screen.getByText('No recent audit activity')).toBeInTheDocument();
  });

  it('supports loading, sanitized errors and a successful retry without fallback', async () => {
    const dashboard = vi.fn().mockRejectedValueOnce(new Error('private server detail')).mockResolvedValue(dashboardFixture);
    mount({ service: { dashboard, audit: vi.fn() } });
    expect(await screen.findByText('Dashboard unavailable')).toBeInTheDocument();
    expect(screen.queryByText('private server detail')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('9 / 18')).toBeInTheDocument();
    expect(dashboard).toHaveBeenCalledTimes(2);
  });
});

describe('CORE-052 audit viewer', () => {
  it('renders append-only records, handles automatic/deactivated historical actors and sorts newest first', async () => {
    const records = [{ ...auditEntry, id: 90, occurredAt: '2026-10-16T01:00:00Z', actor: null, actorRole: null }, auditEntry];
    mount({ path: '/admin/audit-log', service: { dashboard: vi.fn(), audit: vi.fn().mockResolvedValue({ ...auditPageFixture, items: records, totalItems: 2 }) } });
    const table = await screen.findByRole('table', { name: 'Audit log, newest first' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Club Manager Test');
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('Automatic backend action');
    expect(screen.queryByRole('button', { name: /edit|delete|create|export/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Records remain available for deactivated accounts/)).toBeInTheDocument();
  });

  it('applies API filters, serializes dates and resets pagination', async () => {
    const { service, router } = mount({ path: '/admin/audit-log' });
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'REGISTRATION_APPROVED' } });
    fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'REGISTRATION' } });
    fireEvent.change(screen.getByLabelText('From (local time)'), { target: { value: '2026-10-01T09:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(service.audit).toHaveBeenLastCalledWith(expect.objectContaining({ actor: 12, action: 'REGISTRATION_APPROVED', targetType: 'REGISTRATION', from: new Date('2026-10-01T09:30').toISOString(), page: 0 }), expect.objectContaining({ token: 'test-only-session' })));
    expect(new URLSearchParams(router.state.location.search).get('actor')).toBe('12');
  });

  it('validates actor/date range without calling API and resets unsaved invalid input', async () => {
    const { service } = mount({ path: '/admin/audit-log' });
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText('From (local time)'), { target: { value: '2026-10-17T10:30' } });
    fireEvent.change(screen.getByLabelText('To (local time)'), { target: { value: '2026-10-01T10:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByText('Enter a positive, whole actor ID.')).toBeInTheDocument();
    expect(screen.getByText('End time must be on or after start time.')).toBeInTheDocument();
    expect(service.audit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByLabelText('Actor ID')).toHaveValue('');
    expect(screen.getByLabelText('From (local time)')).toHaveValue('');
    expect(screen.queryByText('Enter a positive, whole actor ID.')).not.toBeInTheDocument();
  });

  it('does not request malformed deep links and allows reset', async () => {
    const { service } = mount({ path: '/admin/audit-log?page=-2&actor=0' });
    expect(await screen.findByText('Invalid page')).toBeInTheDocument();
    expect(service.audit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(service.audit).toHaveBeenCalledOnce();
  });

  it('supports current-page role/search without pretending to filter all records', async () => {
    const { service } = mount({ path: '/admin/audit-log' });
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Role on this page'), 'GROOM');
    expect(await screen.findByText('No records on this page match')).toBeInTheDocument();
    expect(screen.getByText(/0 visible on this page/)).toBeInTheDocument();
    expect(service.audit).toHaveBeenCalledOnce();
    await userEvent.selectOptions(screen.getByLabelText('Role on this page'), 'CLUB_MANAGER');
    fireEvent.change(screen.getByLabelText('Search this page'), { target: { value: 'not-on-this-page' } });
    expect(await screen.findByText('No records on this page match')).toBeInTheDocument();
    expect(service.audit).toHaveBeenCalledOnce();
  });

  it('paginates against server metadata and retains filters across back navigation', async () => {
    const audit = vi.fn().mockImplementation(async (query) => ({ ...auditPageFixture, size: 10, page: query.page, totalItems: 11, totalPages: 2 }));
    const { router } = mount({ path: '/admin/audit-log?actor=12&size=10', service: { dashboard: vi.fn(), audit } });
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, actor: 12, size: 10 }), expect.anything());
    await act(() => router.navigate(-1));
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Actor ID')).toHaveValue('12');
  });

  it('aborts a previous request and ignores a late response after filter navigation', async () => {
    let finishOld!: (data: AuditPage) => void;
    const audit = vi.fn().mockImplementationOnce(() => new Promise<AuditPage>((resolve) => { finishOld = resolve; })).mockResolvedValue({ ...auditPageFixture, items: [{ ...auditEntry, safeSummary: 'Latest result.' }] });
    const { router } = mount({ path: '/admin/audit-log', service: { dashboard: vi.fn(), audit } });
    expect(await screen.findByText('Loading audit records…')).toBeInTheDocument();
    await act(() => router.navigate('/admin/audit-log?action=NEW_ACTION'));
    expect(await screen.findByText('Latest result.')).toBeInTheDocument();
    expect(audit.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { finishOld({ ...auditPageFixture, items: [{ ...auditEntry, safeSummary: 'Stale result.' }] }); });
    expect(screen.queryByText('Stale result.')).not.toBeInTheDocument();
    expect(screen.getByText('Latest result.')).toBeInTheDocument();
  });

  it('handles no records and offers recovery from an empty later page', async () => {
    const audit = vi.fn().mockImplementation(async (query) => ({ items: [], page: query.page, size: 20, totalItems: 0, totalPages: 0 }));
    mount({ path: '/admin/audit-log?page=2', service: { dashboard: vi.fn(), audit } });
    expect(await screen.findByText('No audit records match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'First page' }));
    expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('renders audit summaries as text, never executable HTML', async () => {
    mount({ path: '/admin/audit-log', service: { dashboard: vi.fn(), audit: vi.fn().mockResolvedValue({ ...auditPageFixture, items: [{ ...auditEntry, safeSummary: '<script>privateScript()</script>' }] }) } });
    expect(await screen.findByText('<script>privateScript()</script>')).toBeInTheDocument();
    expect(document.querySelector('td script')).toBeNull();
  });
});
