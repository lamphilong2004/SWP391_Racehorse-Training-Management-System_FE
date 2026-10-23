import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { readActiveHerd, readHorseIdentity } from './horseRead';
import { MedicalProvider } from './runtime';
import { HerdHealthPage } from './pages';
import { createMedicalService } from './service';

const storm = { id: 14, horseCode: 'ST-014', name: 'Storm', lifecycle: 'ACTIVE', healthStatus: 'MONITORING', trainingAvailability: 'LIMITED', currentBoxCode: 'B-03' };
const empty = { items: [], page: 0, size: 100, totalItems: 0, totalPages: 0 };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
it('reads the approved ACTIVE HorseSummary projection and all pages, retaining only required overview fields', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ items: [storm], page: 0, size: 1, totalItems: 2, totalPages: 2 }))
    .mockResolvedValueOnce(ok({ items: [{ ...storm, id: 15, name: 'Khác', breed: 'do not copy unrelated fields' }], page: 1, size: 1, totalItems: 2, totalPages: 2 }));
  const rows = await readActiveHerd('session', undefined, { baseUrl: '', fetcher });
  expect(rows.map((h) => h.id)).toEqual([14, 15]);
  expect(rows[1]).not.toHaveProperty('breed');
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/horses?lifecycle=ACTIVE&page=0&size=100', '/api/horses?lifecycle=ACTIVE&page=1&size=100']);
});
it.each([{ ...storm, lifecycle: 'DRAFT' }, { ...storm, trainingAvailability: undefined }, { ...storm, healthStatus: 'UNKNOWN_BUSINESS_STATE' }])('fails closed on out-of-scope/malformed horse data %j', async (row) => {
  const fetcher = vi.fn().mockResolvedValue(ok({ ...empty, items: [row], totalItems: 1, totalPages: 1 }));
  await expect(readActiveHerd('session', undefined, { baseUrl: '', fetcher })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('accepts a genuinely empty herd and rejects incomplete pagination instead of deriving false counts', async () => {
  expect(await readActiveHerd('session', undefined, { baseUrl: '', fetcher: vi.fn().mockResolvedValue(ok(empty)) })).toEqual([]);
  await expect(readActiveHerd('session', undefined, { baseUrl: '', fetcher: vi.fn().mockResolvedValue(ok({ ...empty, items: [storm], totalItems: 2, totalPages: 1 })) })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('keeps the working Horse API grid when the separate clinical aggregate is unavailable', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).includes('/api/horses?') ? ok({ ...empty, items: [storm], totalItems: 1, totalPages: 1 }) :
    new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Clinical overview unavailable', details: [] } }), { status: 404 }));
  render(<MemoryRouter><MedicalProvider value={{ actor: { id: 7, fullName: 'Vet', email: 'vet@example.test', userCode: 'V7', accountStatus: 'ACTIVE', roles: ['VETERINARIAN'] }, service: createMedicalService('session', undefined, { baseUrl: '', fetcher }) }}><HerdHealthPage /></MedicalProvider></MemoryRouter>);
  expect(await screen.findByText('Storm')).toBeInTheDocument();
  expect(await screen.findByText('Clinical overview unavailable')).toBeInTheDocument();
  expect(screen.getByText('ST-014 · Ô B-03')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Khỏe · 0' }));
  expect(await screen.findByText('Không có ngựa phù hợp bộ lọc')).toBeInTheDocument();
  expect(screen.queryByText('Storm')).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('reads only the requested assigned Horse ID and returns the non-clinical identity allowlist', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ ...storm, pedigree: { sire: null, dam: null }, currentOwnerships: [] })).mockResolvedValueOnce(ok({ ...storm, id: 99 }));
  const result = await readHorseIdentity('session', 14, undefined, { baseUrl: '', fetcher });
  expect(result.name).toBe('Storm');
  expect(result).not.toHaveProperty('currentOwnerships');
  expect(fetcher.mock.calls[0][0]).toBe('/api/horses/14');
  await expect(readHorseIdentity('session', 14, undefined, { baseUrl: '', fetcher })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
