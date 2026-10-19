export function stagingSettings(profile, env) {
  if (!['preview', 'api'].includes(profile)) throw new Error('Set RACEHORSE_STAGING_MODE=preview or api, or select build:staging:preview/api. Sample builds are retired.');
  validateDeploymentContext(profile, env);
  if (env.VITE_BUSINESS_DATA_SOURCE === 'sample' || env.VITE_STAGING_SAMPLE === 'true' || env.VITE_DEMO_UI_ONLY === 'true') throw new Error('Staging builds reject sample/harness flags.');
  const backend = env.VITE_API_BASE_URL ? publicOrigin(env.VITE_API_BASE_URL) : null;
  // Protected Preview: real API client plus a role test login with no server authority (UI inspection only).
  if (profile === 'preview') return { mode: 'staging-preview', env: { VITE_ROLE_TEST_LOGIN: 'true', VITE_BUSINESS_DATA_SOURCE: 'api', VITE_API_BASE_URL: backend ?? '/', VITE_API_PROXY_TARGET: '' } };
  if (env.VITE_ROLE_TEST_LOGIN === 'true') throw new Error('API staging rejects the role test login.');
  if (!backend) throw new Error('API staging requires VITE_API_BASE_URL=https://<backend-origin>.');
  return { mode: 'staging-api', env: { VITE_ROLE_TEST_LOGIN: 'false', VITE_BUSINESS_DATA_SOURCE: 'api', VITE_API_BASE_URL: backend, VITE_API_PROXY_TARGET: '' } };
}

function publicOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('VITE_API_BASE_URL must be https://<backend-origin>.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))
    throw new Error('Staging requires a public HTTPS backend origin, without credentials, path, query or fragment.');
  return url.origin;
}

// Accident prevention only: actual Gate, branch protection and release approval remain external.
export const MAIN_PREVIEW_BRANCH = 'preview/role-test-main';

function previewPins(env) {
  const expected = env.RACEHORSE_PREVIEW_EXPECTED_SHA;
  const main = env.RACEHORSE_PREVIEW_MAIN_SHA;
  if (![expected, main].every((value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)))
    throw new Error('Main-source Preview requires full lowercase RACEHORSE_PREVIEW_EXPECTED_SHA and RACEHORSE_PREVIEW_MAIN_SHA.');
  return { expected, main };
}

export function validateDeploymentContext(profile, env) {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === 'development') return;
  if (env.VERCEL_ENV === 'preview') {
    const branch = env.VERCEL_GIT_COMMIT_REF;
    if (branch === MAIN_PREVIEW_BRANCH) {
      const { expected } = previewPins(env);
      if (env.VERCEL_GIT_COMMIT_SHA !== expected) throw new Error('Preview deployment SHA does not match RACEHORSE_PREVIEW_EXPECTED_SHA.');
    } else if (branch !== 'integration/fe-product-main') throw new Error(`Preview builds require ${MAIN_PREVIEW_BRANCH} or the historical integration/fe-product-main source.`);
    return;
  }
  if (env.VERCEL_ENV !== 'production') throw new Error('Unknown Vercel deployment environment.');
  // Leader decision 2026-10-19: Production deploys automatically from `main` with `npm run build` (vercel.json).
  throw new Error('Staging profiles never build Production. Production is built from main with npm run build.');
}

// Git evidence is supplied by the build runner. Metadata alone does not establish checkout identity or ancestry.
export function stagingSourceMetadata(env, checkout = {}) {
  const isPreview = env.VERCEL_ENV === 'preview';
  if (isPreview) {
    validateDeploymentContext('preview', env);
    if (checkout.gitVerified !== true) throw new Error('Cannot verify the Preview Git source. Successful Git revision, branch and status probes are required.');
    if (typeof checkout.dirty !== 'boolean') throw new Error('Cannot verify the Preview Git worktree state.');
  }
  if (!/^[0-9a-f]{40}$/.test(checkout.revision ?? '')) throw new Error('Cannot verify the staging checkout SHA.');
  const branch = isPreview ? env.VERCEL_GIT_COMMIT_REF : checkout.branch || null;
  const hasPins = Boolean(env.RACEHORSE_PREVIEW_EXPECTED_SHA || env.RACEHORSE_PREVIEW_MAIN_SHA);
  if (isPreview) {
    if (env.VERCEL_GIT_COMMIT_SHA !== checkout.revision) throw new Error('Vercel Preview SHA does not match the actual Git checkout.');
    // Vercel may name its internal checkout master or detach HEAD. Deployment metadata
    // identifies the source branch; the actual Git revision, pins and ancestry verify its contents.
    if (hasPins && branch !== MAIN_PREVIEW_BRANCH) throw new Error(`Main-source Preview pins apply only to ${MAIN_PREVIEW_BRANCH}.`);
    if (branch === MAIN_PREVIEW_BRANCH && checkout.dirty) throw new Error('Main-source Preview requires a clean Git checkout matching the reviewed SHA.');
  }
  const pinned = branch === MAIN_PREVIEW_BRANCH || hasPins;
  let sourceMainRevision = null;
  if (pinned) {
    const { expected, main } = previewPins(env);
    if (checkout.revision !== expected) throw new Error('Staging checkout SHA does not match RACEHORSE_PREVIEW_EXPECTED_SHA.');
    if (checkout.mainIsAncestor !== true) throw new Error('Pinned main SHA is not a verified ancestor of the checkout. Make its Git history available before building.');
    sourceMainRevision = main;
  }
  return {
    revision: checkout.revision,
    sourceBranch: branch,
    sourceMainRevision,
    workingTreeDirty: Boolean(checkout.dirty),
    sourceKind: sourceMainRevision ? 'main-snapshot' : branch === 'integration/fe-product-main' ? 'historical-integration' : 'local',
  };
}

export function safeOutput(name = 'dist-staging') {
  if (!/^dist-staging(?:-preview|-api)?$/.test(name)) throw new Error('Output must be dist-staging, dist-staging-preview or dist-staging-api.');
  return name;
}
