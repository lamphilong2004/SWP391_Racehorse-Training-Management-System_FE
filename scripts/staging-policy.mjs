export function stagingSettings(profile, env) {
  if (!['sample', 'api'].includes(profile)) throw new Error('Set RACEHORSE_STAGING_MODE=sample or api, or select build:staging:sample/api.');
  validateDeploymentContext(profile, env);
  if (profile === 'sample') return { mode: 'staging-sample', env: { VITE_STAGING_SAMPLE: 'true', VITE_BUSINESS_DATA_SOURCE: 'sample', VITE_API_BASE_URL: '/', VITE_DEMO_UI_ONLY: 'false', VITE_API_PROXY_TARGET: '' } };
  let url;
  try { url = new URL(env.VITE_API_BASE_URL); } catch { throw new Error('API staging requires VITE_API_BASE_URL=https://<backend-origin>.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))
    throw new Error('API staging requires a public HTTPS backend origin, without credentials, path, query or fragment.');
  if (env.VITE_BUSINESS_DATA_SOURCE === 'sample' || env.VITE_STAGING_SAMPLE === 'true' || env.VITE_DEMO_UI_ONLY === 'true') throw new Error('API staging rejects sample/harness flags.');
  return { mode: 'staging-api', env: { VITE_STAGING_SAMPLE: 'false', VITE_BUSINESS_DATA_SOURCE: 'api', VITE_API_BASE_URL: url.origin, VITE_DEMO_UI_ONLY: 'false', VITE_API_PROXY_TARGET: '' } };
}

// Accident prevention only: actual Gate, branch protection and release approval remain external.
export function validateDeploymentContext(profile, env) {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === 'development') return;
  if (env.VERCEL_ENV === 'preview') {
    if (env.VERCEL_GIT_COMMIT_REF !== 'integration/fe-product-main') throw new Error('Preview builds require integration/fe-product-main source metadata.');
    return;
  }
  if (env.VERCEL_ENV !== 'production') throw new Error('Unknown Vercel deployment environment.');
  if (profile !== 'api' || env.VERCEL_GIT_COMMIT_REF !== 'main') throw new Error('Production requires API mode from main; sample/integration releases are forbidden.');
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha || '') || env.RACEHORSE_APPROVED_RELEASE_SHA !== sha) throw new Error('Production requires explicit approval for this exact release SHA.');
  let host;
  try { host = new URL(env.VITE_API_BASE_URL).hostname; } catch { throw new Error('Production requires a configured backend origin.'); }
  if (/(?:^|\.)(?:invalid|test|example|example\.com|example\.org|example\.net)$/i.test(host)) throw new Error('Production rejects placeholder backend domains.');
}

export function safeOutput(name = 'dist-staging') {
  if (!/^dist-staging(?:-sample|-api)?$/.test(name)) throw new Error('Output must be dist-staging, dist-staging-sample or dist-staging-api.');
  return name;
}
