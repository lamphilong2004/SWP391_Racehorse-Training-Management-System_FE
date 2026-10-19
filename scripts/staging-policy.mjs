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
export function validateDeploymentContext(profile, env) {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === 'development') return;
  if (env.VERCEL_ENV === 'preview') {
    if (env.VERCEL_GIT_COMMIT_REF !== 'integration/fe-product-main') throw new Error('Preview builds require integration/fe-product-main source metadata.');
    return;
  }
  if (env.VERCEL_ENV !== 'production') throw new Error('Unknown Vercel deployment environment.');
  // Leader decision 2026-10-19: Production deploys automatically from `main` with `npm run build` (vercel.json).
  throw new Error('Staging profiles never build Production. Production is built from main with npm run build.');
}

export function safeOutput(name = 'dist-staging') {
  if (!/^dist-staging(?:-preview|-api)?$/.test(name)) throw new Error('Output must be dist-staging, dist-staging-preview or dist-staging-api.');
  return name;
}
