import { describe, expect, it, vi } from 'vitest';
import { createProgramCreationApi } from './programApi';
import { createdProgram, template, validRequest } from './__tests__/fixtures';

type FixtureRequest = (path: string, init?: RequestInit) => Promise<unknown>;

function testApi(request: FixtureRequest) {
  return createProgramCreationApi(async <T>(path: string, init?: RequestInit) => (await request(path, init)) as T);
}

describe('CORE-022 contract adapter', () => {
  it('requests active horses and templates with encoded paging/search, not a client-side all-horse filter', async () => {
    const request = vi.fn<FixtureRequest>().mockResolvedValue({ items: [] });
    const api = testApi(request);

    await api.listHorses({ q: 'Thunder & Bolt', page: 1, size: 10 });
    await api.listTemplates();

    expect(request.mock.calls[0]?.[0]).toBe('/api/horses?lifecycle=ACTIVE&q=Thunder+%26+Bolt&page=1&size=10');
    expect(request.mock.calls[1]?.[0]).toBe('/api/program-templates?status=ACTIVE&page=0&size=20');
  });

  it('keeps template version number distinct from the pinned template version ID for Trainer selection', async () => {
    const request = vi.fn<FixtureRequest>().mockResolvedValue(template);
    const api = testApi(request);
    const signal = new AbortController().signal;

    const selected = await api.template(3, 2, signal);
    await api.templateRecommendations(7);
    await api.trainerRecommendations(7, selected.version.id);

    expect(request.mock.calls[0]).toEqual(['/api/program-templates/3?versionNo=2', { signal }]);
    expect(request.mock.calls[1]?.[0]).toBe('/api/horses/7/template-recommendations');
    expect(request.mock.calls[2]?.[0]).toBe('/api/horses/7/trainer-recommendations?templateVersionId=302');
  });

  it('submits only the creation DTO and returns the server-created program, without modifying the template', async () => {
    const request = vi.fn<FixtureRequest>().mockResolvedValue(createdProgram);
    const api = testApi(request);
    const input = { ...validRequest(), targetRaceId: 99, status: 'COMPLETED' };
    input.phases = input.phases.map((phase) => ({ ...phase, id: 900, surface: 'TURF' }));
    const original = structuredClone(input);

    expect(await api.create(input)).toEqual(createdProgram);

    expect(request).toHaveBeenCalledTimes(1);
    const [path, options] = request.mock.calls[0]!;
    expect(path).toBe('/api/training-programs');
    expect(options?.method).toBe('POST');
    const body = JSON.parse(String(options?.body));
    expect(body.templateVersionId).toBe(302);
    expect(body.trainer).toEqual(validRequest().trainer);
    expect(body).not.toHaveProperty('targetRaceId');
    expect(body).not.toHaveProperty('status');
    expect(body.phases[0]).not.toHaveProperty('id');
    expect(body.phases[0]).not.toHaveProperty('surface');
    expect(input).toEqual(original);
  });

  it('propagates the backend rule/validation error without a fake program or a duplicate POST', async () => {
    const error = Object.assign(new Error('Horse is LOCKED: rest required.'), {
      status: 409, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'horseId', message: 'Rest required.' }],
    });
    const request = vi.fn<FixtureRequest>().mockRejectedValue(error);

    await expect(testApi(request).create(validRequest())).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
