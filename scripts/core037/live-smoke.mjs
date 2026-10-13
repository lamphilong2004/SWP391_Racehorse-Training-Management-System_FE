import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

class ServiceUnavailableError extends Error {
  name = 'ServiceUnavailableError';
}

const networkErrorCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH',
  'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
]);

function isUnavailable(error) {
  if (!error) return false;
  return error?.name === 'TimeoutError' || networkErrorCodes.has(error?.code) ||
    isUnavailable(error?.cause) || (Array.isArray(error?.errors) && error.errors.some(isUnavailable));
}

async function fetchService(fetchImpl, url, options) {
  try {
    return await fetchImpl(url, options);
  } catch (error) {
    if (isUnavailable(error)) {
      throw new ServiceUnavailableError(`Dependent service unavailable at ${new URL(url).origin}`, { cause: error });
    }
    throw error;
  }
}

function base(value, name) {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${name} must use HTTP(S)`);
  return url.href.replace(/\/$/, '');
}

async function request(fetchImpl, origin, path, token, options = {}) {
  const response = await fetchService(fetchImpl, origin + path, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body = await response.json().catch(error => {
    if (isUnavailable(error)) throw new ServiceUnavailableError(`Dependent service unavailable at ${origin}`, { cause: error });
    return null;
  });
  return { status: response.status, body };
}

function envelope(result, success) {
  assert.equal(result.body?.success, success, `Unexpected API envelope at HTTP ${result.status}`);
  if (success) assert.ok('data' in result.body, 'Success response has no data');
  else {
    assert.equal(typeof result.body?.error?.code, 'string');
    assert.equal(typeof result.body?.error?.message, 'string');
    assert.ok(Array.isArray(result.body?.error?.details));
  }
}

export async function runLiveSmoke({ env = process.env, fetchImpl = fetch,
  log = console.log, errorLog = console.error } = {}) {
  const { CORE037_BE_BASE_URL: backend, CORE037_FE_BASE_URL: frontend,
    CORE037_VET_JWT: vetToken, CORE037_GROOM_JWT: groomToken,
    CORE037_TEST_CASE_ID: caseId, CORE037_ALLOW_MUTATION: allowMutation } = env;
  const mutationRequested = allowMutation === '1' && Boolean(caseId);
  let mutationStarted = false;
  try {
    if (!backend || !frontend || !vetToken || !groomToken) {
      throw new ServiceUnavailableError('Set CORE037_BE_BASE_URL, CORE037_FE_BASE_URL, CORE037_VET_JWT and CORE037_GROOM_JWT for real-service checks.');
    }
    const be = base(backend, 'CORE037_BE_BASE_URL');
    const fe = base(frontend, 'CORE037_FE_BASE_URL');
    const page = await fetchService(fetchImpl, fe + '/medical', { signal: AbortSignal.timeout(5000) });
    assert.equal(page.status, 200, 'Frontend route is unavailable');
    assert.match(page.headers.get('content-type') ?? '', /text\/html/, 'Frontend did not serve HTML');
    log('PASS: Frontend host serves the medical route (HTML response only; no browser UI assertion).');

    const unauthenticated = await request(fetchImpl, be, '/api/medical/cases');
    assert.equal(unauthenticated.status, 401);
    envelope(unauthenticated, false);
    assert.equal(unauthenticated.body.error.code, 'UNAUTHORIZED');
    log('PASS: missing JWT returns the shared 401 envelope.');

    const vetCases = await request(fetchImpl, be, '/api/medical/cases?page=0&size=20', vetToken);
    assert.equal(vetCases.status, 200); envelope(vetCases, true);
    assert.ok(Array.isArray(vetCases.body.data.items));
    assert.equal(vetCases.body.data.page, 0);
    log('PASS: Vet case list maps to a zero-based page.');

    const vetIncidents = await request(fetchImpl, be, '/api/incidents?page=0&size=20', vetToken);
    assert.equal(vetIncidents.status, 200); envelope(vetIncidents, true);
    assert.ok(Array.isArray(vetIncidents.body.data.items));
    log('PASS: Vet incident list is reachable.');

    const groomCases = await request(fetchImpl, be, '/api/medical/cases', groomToken);
    assert.equal(groomCases.status, 403); envelope(groomCases, false);
    assert.equal(groomCases.body.error.code, 'FORBIDDEN');
    const groomTasks = await request(fetchImpl, be, '/api/groom/treatment-tasks?page=0&size=20', groomToken);
    assert.equal(groomTasks.status, 200); envelope(groomTasks, true);
    assert.ok(Array.isArray(groomTasks.body.data.items));
    for (const task of groomTasks.body.data.items) {
      assert.ok(['PENDING', 'COMPLETED'].includes(task.status));
      for (const clinical of ['diagnosis', 'treatmentMedicationInstructions', 'reexaminations', 'caseId'])
        assert.ok(!(clinical in task), `Groom projection exposes ${clinical}`);
    }
    log('PASS: Groom can read scoped care tasks but is denied clinical cases.');

    const vetTasks = await request(fetchImpl, be, '/api/groom/treatment-tasks', vetToken);
    assert.equal(vetTasks.status, 403); envelope(vetTasks, false);
    log('PASS: Vet cannot use the Groom work list.');

    if (mutationRequested) {
      assert.match(caseId, /^[1-9]\d*$/, 'CORE037_TEST_CASE_ID must be a positive integer');
      mutationStarted = true;
      const path = `/api/medical/cases/${caseId}`;
      const before = await request(fetchImpl, be, path, vetToken);
      assert.equal(before.status, 200); envelope(before, true);
      const stamp = new Date().toISOString();
      const submitted = await request(fetchImpl, be, path + '/re-examinations', vetToken, {
        method: 'POST', body: JSON.stringify({ recoveryStatus: 'IMPROVING', findings: `CORE-037 isolated test ${stamp}`, examinedAt: stamp }),
      });
      assert.equal(submitted.status, 201); envelope(submitted, true);
      const after = await request(fetchImpl, be, path, vetToken);
      assert.equal(after.status, 200); envelope(after, true);
      assert.ok(after.body.data.reexaminations.some(item => item.id === submitted.body.data.id && item.recoveryStatus === 'IMPROVING'));
      log('PASS: Real re-examination POST persisted and appeared after a fresh GET.');
    }
    log('LIMIT: HTTP checks do not prove browser role routing, rendering, or training interlock.');
    return 0;
  } catch (error) {
    const blocked = error instanceof ServiceUnavailableError;
    errorLog(`${blocked ? 'BLOCKED' : 'FAIL'}: ${error.name}: ${error.message}`);
    return blocked ? 2 : 1;
  } finally {
    if (!mutationStarted) {
      log(mutationRequested
        ? 'NOT RUN: write/persistence check stopped before execution.'
        : 'NOT RUN: write/persistence check requires CORE037_ALLOW_MUTATION=1 and CORE037_TEST_CASE_ID in an isolated test environment.');
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runLiveSmoke();
}
