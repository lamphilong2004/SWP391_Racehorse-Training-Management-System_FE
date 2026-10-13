import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLiveSmoke } from './live-smoke.mjs';

const env = {
  CORE037_BE_BASE_URL: 'http://backend.test',
  CORE037_FE_BASE_URL: 'http://frontend.test',
  CORE037_VET_JWT: 'vet-token',
  CORE037_GROOM_JWT: 'groom-token',
};

const ok = data => Response.json({ success: true, data });
const denied = (status, code) => Response.json({
  success: false, error: { code, message: code, details: [] },
}, { status });

function fixtureFetch(url, options = {}) {
  const { pathname, search } = new URL(url);
  const token = options.headers?.Authorization;
  if (pathname === '/medical') return new Response('<html></html>', {
    headers: { 'content-type': 'text/html' },
  });
  if (pathname === '/api/medical/cases' && !token) return denied(401, 'UNAUTHORIZED');
  if (pathname === '/api/medical/cases' && token === 'Bearer groom-token') return denied(403, 'FORBIDDEN');
  if (pathname === '/api/medical/cases' && search) return ok({ items: [], page: 0 });
  if (pathname === '/api/incidents') return ok({ items: [] });
  if (pathname === '/api/groom/treatment-tasks' && token === 'Bearer vet-token') return denied(403, 'FORBIDDEN');
  if (pathname === '/api/groom/treatment-tasks') return ok({ items: [{ status: 'PENDING' }] });
  throw new Error(`Unexpected request: ${pathname}`);
}

async function run(options = {}) {
  const output = [];
  const errors = [];
  const code = await runLiveSmoke({
    env,
    fetchImpl: fixtureFetch,
    log: message => output.push(message),
    errorLog: message => errors.push(message),
    ...options,
  });
  return { code, output, errors };
}

test('successful HTTP checks are PASS; unapproved mutation is NOT RUN; no Full E2E PASS', async () => {
  const { code, output, errors } = await run();
  assert.equal(code, 0);
  assert.equal(errors.length, 0);
  assert.equal(output.filter(line => line.startsWith('PASS:')).length, 6);
  assert.equal(output.filter(line => line.startsWith('NOT RUN:')).length, 1);
  assert.ok(output.some(line => line.startsWith('LIMIT: HTTP checks')));
  assert.doesNotMatch(output.join('\n'), /Full E2E PASS/i);
});

test('approved mutation check reports PASS after the fresh GET confirms persistence', async () => {
  let posted = false;
  const fetchImpl = (url, options) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/medical/cases/7/re-examinations' && options.method === 'POST') {
      posted = true;
      return Response.json({ success: true, data: { id: 9 } }, { status: 201 });
    }
    if (pathname === '/api/medical/cases/7') {
      return ok({ reexaminations: posted ? [{ id: 9, recoveryStatus: 'IMPROVING' }] : [] });
    }
    return fixtureFetch(url, options);
  };
  const { code, output, errors } = await run({
    env: { ...env, CORE037_ALLOW_MUTATION: '1', CORE037_TEST_CASE_ID: '7' }, fetchImpl,
  });
  assert.equal(code, 0);
  assert.equal(errors.length, 0);
  assert.ok(output.some(line => line.startsWith('PASS: Real re-examination POST')));
  assert.ok(output.every(line => !line.startsWith('NOT RUN:')));
  assert.doesNotMatch(output.join('\n'), /Full E2E PASS/i);
});

test('missing required configuration is BLOCKED with exit code 2', async () => {
  const { code, output, errors } = await run({ env: {} });
  assert.equal(code, 2);
  assert.match(errors[0], /^BLOCKED:/);
  assert.match(output.at(-1), /^NOT RUN:/);
});

test('unavailable service is BLOCKED with exit code 2', async () => {
  const fetchImpl = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  };
  const { code, errors } = await run({ fetchImpl });
  assert.equal(code, 2);
  assert.match(errors[0], /^BLOCKED:/);
});

test('incorrect HTTP response is FAIL with exit code 1', async () => {
  const { code, errors } = await run({ fetchImpl: (url, options) =>
    new URL(url).pathname === '/medical'
      ? new Response('unavailable', { status: 503 })
      : fixtureFetch(url, options) });
  assert.equal(code, 1);
  assert.match(errors[0], /^FAIL: AssertionError:/);
});

test('invalid API response schema is FAIL with exit code 1', async () => {
  const { code, errors } = await run({ fetchImpl: (url, options) =>
    new URL(url).pathname === '/api/incidents'
      ? ok({ items: 'not-an-array' })
      : fixtureFetch(url, options) });
  assert.equal(code, 1);
  assert.match(errors[0], /^FAIL: AssertionError:/);
});

test('unexpected runtime error is FAIL with exit code 1', async () => {
  const { code, errors } = await run({ fetchImpl: () => { throw new Error('unexpected'); } });
  assert.equal(code, 1);
  assert.match(errors[0], /^FAIL: Error: unexpected$/);
});

test('CLI exits 2 and prints BLOCKED when required configuration is missing', () => {
  const cliEnv = { ...process.env };
  for (const name of Object.keys(env)) delete cliEnv[name];
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./live-smoke.mjs', import.meta.url))], {
    env: cliEnv, encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^BLOCKED:/);
  assert.match(result.stdout, /^NOT RUN:/);
});

test('CLI exits 1 and prints FAIL for invalid configuration value', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./live-smoke.mjs', import.meta.url))], {
    env: { ...process.env, ...env, CORE037_BE_BASE_URL: 'not-a-url' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^FAIL:/);
  assert.doesNotMatch(result.stderr, /BLOCKED:/);
});
