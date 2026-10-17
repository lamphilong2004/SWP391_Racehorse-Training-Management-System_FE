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
import { ManagementProvider, type ManagementDestinations } from './ManagementProvider';
import { ManagementAccess } from './ManagementAccess';
import { ClubManagerDashboardEntry, core052AuditRoute } from './routes';
import { auditEntry, auditPageFixture, dashboardFixture } from './management.fixtures';
import type { AuditPage, ManagementService } from './types';

const manager: CurrentUser = { id: 12, userCode: 'U-012', fullName: 'Manager Test', email: 'manager@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };

function mount({ path = '/dashboard', roles = ['CLUB_MANAGER'], service, signedIn = true, destinations = {} }: { path?: string; roles?: RoleCode[]; service?: ManagementService; signedIn?: boolean; destinations?: ManagementDestinations } = {}) {
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
    { path: '/horses/new', element: <ManagementAccess><h1>Registered horse destination fixture</h1></ManagementAccess> },
    { path: '/admin/roles', element: <ManagementAccess><h1>Read-only roles destination fixture</h1></ManagementAccess> },
  ], { initialEntries: [path] });
  render(<AuthProvider api={api}><ManagementProvider service={selected} destinations={destinations}><RouterProvider router={router} /></ManagementProvider></AuthProvider>);
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

  it('keeps standalone refresh/sign-out out of the Figma dashboard without modifying the shared session', async () => {
    const { api } = mount();
    await screen.findByText('9 / 18');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refresh$/ })).not.toBeInTheDocument();
    expect(api.logout).not.toHaveBeenCalled();
    expect(authSession.read()).not.toBeNull();
  });
});

describe('CORE-052 dashboard', () => {
  it('shows contract-backed management widgets and opens the audit viewer', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { router } = mount();
    expect(await screen.findByText('9 / 18')).toBeInTheDocument();
    expect(screen.getByText('8 ACTIVE · 1 DRAFT · 0 INACTIVE')).toBeInTheDocument();
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

  it('does not expose unintegrated or deferred shortcut buttons', async () => {
    mount();
    expect(await screen.findByText('No shortcuts available')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Register Horse|Create User|Management Reports/ })).not.toBeInTheDocument();
    // The existing shell menu is outside this module; shortcut checks are scoped to its card.
    const shortcuts = screen.getByRole('heading', { name: 'Shortcuts' }).closest('section')!;
    expect(within(shortcuts).queryByRole('link', { name: 'Roles & Permissions' })).not.toBeInTheDocument();
  });

  it('enables Register Horse only through the integrated canonical destination and retains CM access', async () => {
    const { router } = mount({ destinations: { registerHorse: '/horses/new' } });
    await screen.findByText('9 / 18');
    const links = screen.getAllByRole('link', { name: '+ Register Horse' });
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute('href') === '/horses/new')).toBe(true);
    await userEvent.click(links[0]);
    expect(await screen.findByRole('heading', { name: 'Registered horse destination fixture' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/horses/new');
  });

  it('requires a read-only roles destination and never promotes Reports from deferred scope', async () => {
    const { router } = mount({ destinations: { rolesPermissions: { to: '/admin/roles', readOnly: true } } });
    await screen.findByText('9 / 18');
    const shortcuts = screen.getByRole('heading', { name: 'Shortcuts' }).closest('section')!;
    await userEvent.click(within(shortcuts).getByRole('link', { name: 'Roles & Permissions' }));
    expect(await screen.findByRole('heading', { name: 'Read-only roles destination fixture' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/roles');
    expect(screen.queryByRole('link', { name: 'Management Reports' })).not.toBeInTheDocument();
  });

  it('renders recent audit as a chronological text list with only approved display fields', async () => {
    const recentAudit = [{ ...auditEntry, id: 89, occurredAt: '2026-10-16T00:00:00Z', safeSummary: 'Older action.' }, { ...auditEntry, safeSummary: '<img src=x onerror=privateAction()>', passwordHash: 'must-not-render' }];
    mount({ service: { dashboard: vi.fn().mockResolvedValue({ ...dashboardFixture, recentAudit }), audit: vi.fn() } });
    const list = await screen.findByRole('list', { name: 'Recent audit activity, newest first' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('<img src=x onerror=privateAction()>');
    expect(rows[1]).toHaveTextContent('Older action.');
    expect(list.querySelector('img')).toBeNull();
    expect(screen.queryByText('must-not-render')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Recent audit/ })).not.toBeInTheDocument();
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

  it('keeps the date-range popover keyboard operable without inventing preset options', async () => {
    const { service } = mount({ path: '/admin/audit-log' });
    await screen.findByRole('table');
    await userEvent.click(screen.getByText('Date: All'));
    expect(screen.getByLabelText('From (local time)')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByLabelText('From (local time)')).not.toBeVisible();
    expect(service.audit).toHaveBeenCalledOnce();
  });

  it('retains native date-picker input events when closing the popover and applying filters', async () => {
    const { service } = mount({ path: '/admin/audit-log' });
    await screen.findByRole('table');
    await userEvent.click(screen.getByText('Date: All'));
    fireEvent.input(screen.getByLabelText('From (local time)'), { target: { value: '2026-10-17T00:00' } });
    fireEvent.input(screen.getByLabelText('To (local time)'), { target: { value: '2026-10-17T23:59' } });
    await userEvent.click(screen.getByRole('button', { name: 'Close date filter' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(service.audit).toHaveBeenLastCalledWith(expect.objectContaining({ from: new Date('2026-10-17T00:00').toISOString(), to: new Date('2026-10-17T23:59').toISOString() }), expect.anything()));
  });

  it('keeps page size in the audit footer and resets the server page while preserving filters', async () => {
    const audit = vi.fn().mockImplementation(async (query) => ({ ...auditPageFixture, size: query.size, page: query.page }));
    mount({ path: '/admin/audit-log?actor=12', service: { dashboard: vi.fn(), audit } });
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Records per page'), '10');
    await waitFor(() => expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ actor: 12, size: 10, page: 0 }), expect.anything()));
    expect(screen.getByLabelText('Records per page')).toHaveValue('10');
  });

  it('allows recovery from an invalid page-size URL without requesting data or fabricating a page', async () => {
    const { service } = mount({ path: '/admin/audit-log?size=101' });
    expect(await screen.findByText('Invalid page size')).toBeInTheDocument();
    expect(service.audit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(service.audit).toHaveBeenCalledOnce();
  });
});
