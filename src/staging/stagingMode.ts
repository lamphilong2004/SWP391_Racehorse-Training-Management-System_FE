/**
 * Protected non-production Preview only (Leader directive 2026-10-18): a role test login for UI inspection before the
 * real Auth API is online. It grants NO server authority — every API call with a test identity fails explicitly.
 * Both values are inlined at build time; normal, API-staging and production builds drop the whole feature.
 */
export const ROLE_TEST_LOGIN = import.meta.env.MODE === 'staging-preview' && import.meta.env.VITE_ROLE_TEST_LOGIN === 'true';
