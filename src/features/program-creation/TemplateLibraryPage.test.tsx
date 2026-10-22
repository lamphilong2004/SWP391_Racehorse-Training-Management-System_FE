import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { TemplateLibraryPage } from './TemplateLibraryPage';

const fixture = vi.hoisted(() => ({ request: vi.fn(), user: { id: 2, fullName: 'Head Trainer', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' } }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: fixture.user, logout: vi.fn() }) }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => fixture.request }));
const detail = {
  template: { id: 10, templateCode: 'TPL-10', name: 'Base conditioning', status: 'ACTIVE', latestVersionNo: 1 },
  version: { id: 100, versionNo: 1, name: 'Base conditioning', goals: 'Base fitness', requiredSkills: [{ id: 12, name: 'Conditioning' }], phases: [{ id: 9, phaseOrder: 1, name: 'Foundation', intensityGuidance: 'LOW' }], createdAt: '2026-10-21T00:00:00Z' },
  versions: [{ id: 100, versionNo: 1, createdAt: '2026-10-21T00:00:00Z' }],
};
const catalog = [{ id: 12, name: 'Conditioning' }, { id: 13, name: 'Rehabilitation' }];
const isCatalog = (path: string) => path === '/api/program-templates/trainer-specializations';
beforeEach(() => {
  fixture.request.mockReset().mockImplementation(async (path: string) => isCatalog(path) ? catalog : path.startsWith('/api/program-templates?') ? { page: 0, size: 20, totalItems: 1, totalPages: 1, items: [detail.template] } : detail);
});
function mount() { render(<RouterProvider router={createMemoryRouter([{ path: '/training/templates', element: <TemplateLibraryPage /> }], { initialEntries: ['/training/templates'] })} />); }

it('keeps a failed creation draft and sends only the approved template DTO', async () => {
  fixture.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') throw new Error('Template name already exists');
    return isCatalog(path) ? catalog : path.includes('?') ? { page: 0, size: 20, totalItems: 0, totalPages: 0, items: [] } : detail;
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Create Template' }));
  fireEvent.change(screen.getByRole('textbox', { name: /Template name/ }), { target: { value: 'Recovery plan' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Phase 1 name/ }), { target: { value: 'Walk' } });
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Rehabilitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Template' }));
  expect(await screen.findByText(/Template name already exists/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Template name/ })).toHaveValue('Recovery plan');
  const write = fixture.request.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(write?.[0]).toBe('/api/program-templates');
  expect(JSON.parse(write?.[1].body)).toMatchObject({ name: 'Recovery plan', requiredSkillIds: [13], phases: [{ phaseOrder: 1, name: 'Walk' }] });
  expect(screen.getByRole('checkbox', { name: 'Rehabilitation' })).toBeChecked();
  expect(screen.queryByText(/^Template .+ · version \d+ saved$/)).not.toBeInTheDocument();
});

it('saves a new version preserving required skills without mutating the old template version or a horse program', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'View Base conditioning' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save New Version' }));
  expect(await screen.findByRole('checkbox', { name: 'Conditioning' })).toBeChecked();
  fireEvent.change(screen.getByRole('textbox', { name: /Template name/ }), { target: { value: 'Base conditioning revised' } });
  fixture.request.mockImplementation(async (path: string, init?: RequestInit) => init?.method === 'POST' ? { ...detail, version: { ...detail.version, versionNo: 2 } } : isCatalog(path) ? catalog : path.includes('?') ? { page: 0, size: 20, totalItems: 1, totalPages: 1, items: [detail.template] } : detail);
  fireEvent.click(screen.getByRole('button', { name: 'Save New Version' }));
  await waitFor(() => expect(fixture.request).toHaveBeenCalledWith('/api/program-templates/10/versions', expect.objectContaining({ method: 'POST' })));
  const write = fixture.request.mock.calls.find(([path]) => path.endsWith('/versions'));
  expect(JSON.parse(write?.[1].body)).toMatchObject({ name: 'Base conditioning revised', requiredSkillIds: [12], phases: [{ phaseOrder: 1, name: 'Foundation', intensityGuidance: 'LOW' }] });
  expect(JSON.parse(write?.[1].body).phases[0]).not.toHaveProperty('id');
  expect(fixture.request.mock.calls.some(([path]) => path.startsWith('/api/training-programs'))).toBe(false);
});

it('archives only after confirmation and preserves the library on a refused server operation', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'View Base conditioning' }));
  fireEvent.click(await screen.findByRole('button', { name: /^Archive$/ }));
  expect(fixture.request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fixture.request.mockRejectedValueOnce(new Error('Template changed; reload'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
  expect(await screen.findByText('Template changed; reload')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeInTheDocument();
});

it('creates a template with only the selected catalog skills', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Create Template' }));
  fireEvent.change(screen.getByRole('textbox', { name: /Template name/ }), { target: { value: 'Recovery template' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Phase 1 name/ }), { target: { value: 'Recovery walk' } });
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Conditioning' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Rehabilitation' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Conditioning' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Template' }));
  await waitFor(() => expect(fixture.request).toHaveBeenCalledWith('/api/program-templates', expect.objectContaining({ method: 'POST' })));
  const write = fixture.request.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(write?.[1].body).requiredSkillIds).toEqual([13]);
});

it('keeps existing required skills when the catalog is unavailable', async () => {
  fixture.request.mockImplementation(async (path: string) => {
    if (isCatalog(path)) throw new Error('Catalog is temporarily unavailable');
    return path.includes('?') ? { page: 0, size: 20, totalItems: 1, totalPages: 1, items: [detail.template] } : detail;
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'View Base conditioning' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save New Version' }));
  expect(await screen.findByText('Trainer specializations unavailable')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Conditioning' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save New Version' }));
  await waitFor(() => expect(fixture.request).toHaveBeenCalledWith('/api/program-templates/10/versions', expect.objectContaining({ method: 'POST' })));
  const write = fixture.request.mock.calls.find(([path]) => path.endsWith('/versions'));
  expect(JSON.parse(write?.[1].body).requiredSkillIds).toEqual([12]);
});
