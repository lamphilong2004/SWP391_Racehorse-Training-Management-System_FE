export function stagingSettings(profile, env) {
  if (!['sample', 'api'].includes(profile)) throw new Error('Set RACEHORSE_STAGING_MODE=sample or api, or select build:staging:sample/api.');
  if (profile === 'sample') return { mode: 'staging-sample', env: { VITE_STAGING_SAMPLE: 'true', VITE_BUSINESS_DATA_SOURCE: 'sample', VITE_API_BASE_URL: '/', VITE_DEMO_UI_ONLY: 'false', VITE_API_PROXY_TARGET: '' } };
  let url;
  try { url = new URL(env.VITE_API_BASE_URL); } catch { throw new Error('API staging requires VITE_API_BASE_URL=https://<backend-origin>.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))
    throw new Error('API staging requires a public HTTPS backend origin, without credentials, path, query or fragment.');
  if (env.VITE_BUSINESS_DATA_SOURCE === 'sample' || env.VITE_STAGING_SAMPLE === 'true' || env.VITE_DEMO_UI_ONLY === 'true') throw new Error('API staging rejects sample/harness flags.');
  return { mode: 'staging-api', env: { VITE_STAGING_SAMPLE: 'false', VITE_BUSINESS_DATA_SOURCE: 'api', VITE_API_BASE_URL: url.origin, VITE_DEMO_UI_ONLY: 'false', VITE_API_PROXY_TARGET: '' } };
}

export function safeOutput(name = 'dist-staging') {
  if (!/^dist-staging(?:-sample|-api)?$/.test(name)) throw new Error('Output must be dist-staging, dist-staging-sample or dist-staging-api.');
  return name;
}
