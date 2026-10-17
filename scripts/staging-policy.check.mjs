import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeOutput, stagingSettings } from './staging-policy.mjs';

test('sample build explicitly disables backend and developer flags', () => {
  assert.deepEqual(stagingSettings('sample', {}).env, { VITE_STAGING_SAMPLE: 'true', VITE_BUSINESS_DATA_SOURCE: 'sample', VITE_API_BASE_URL: '/', VITE_DEMO_UI_ONLY: 'false', VITE_API_PROXY_TARGET: '' });
});
test('API build requires HTTPS and rejects localhost/private or credential-bearing URLs', () => {
  for (const url of [undefined, '/', 'http://api.example.test', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://user:secret@api.example.test', 'https://api.example.test/api', 'https://api.example.test?token=test']) assert.throws(() => stagingSettings('api', { VITE_API_BASE_URL: url }));
  assert.equal(stagingSettings('api', { VITE_API_BASE_URL: 'https://api.example.test' }).env.VITE_API_BASE_URL, 'https://api.example.test');
});
test('API build rejects sample flags instead of silently overriding them', () => {
  for (const key of ['VITE_STAGING_SAMPLE', 'VITE_DEMO_UI_ONLY']) assert.throws(() => stagingSettings('api', { VITE_API_BASE_URL: 'https://api.example.test', [key]: 'true' }));
  assert.throws(() => stagingSettings('api', { VITE_API_BASE_URL: 'https://api.example.test', VITE_BUSINESS_DATA_SOURCE: 'sample' }));
});
test('unknown profile and output escape are rejected', () => {
  assert.throws(() => stagingSettings(undefined, {}));
  assert.throws(() => safeOutput('../outside'));
  assert.equal(safeOutput('dist-staging-sample'), 'dist-staging-sample');
});

const production = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), RACEHORSE_APPROVED_RELEASE_SHA: 'a'.repeat(40), VITE_API_BASE_URL: 'https://api.racehorse.vn' };
test('production rejects sample mode and every non-main source', () => {
  assert.throws(() => stagingSettings('sample', production));
  for (const branch of [undefined, 'dev', 'integration/fe-product-main', 'feat/CORE-008-auth']) assert.throws(() => stagingSettings('api', { ...production, VERCEL_GIT_COMMIT_REF: branch }));
});
test('production requires exact SHA approval and never accepts a placeholder backend', () => {
  for (const sha of [undefined, '', 'b'.repeat(40)]) assert.throws(() => stagingSettings('api', { ...production, RACEHORSE_APPROVED_RELEASE_SHA: sha }));
  assert.throws(() => stagingSettings('api', { ...production, VERCEL_GIT_COMMIT_SHA: 'main', RACEHORSE_APPROVED_RELEASE_SHA: 'main' }));
  for (const host of ['api.example.invalid', 'api.example.test', 'api.example.com', 'api.example.org', 'api.example.net', 'api.example']) assert.throws(() => stagingSettings('api', { ...production, VITE_API_BASE_URL: `https://${host}` }));
  assert.equal(stagingSettings('api', production).mode, 'staging-api');
});
test('Preview accepts only the integration branch; local builds still work', () => {
  for (const profile of ['sample', 'api']) {
    assert.doesNotThrow(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'integration/fe-product-main' }));
    for (const branch of [undefined, 'main', 'dev']) assert.throws(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: branch }));
  }
  assert.throws(() => stagingSettings('api', { ...production, VERCEL_ENV: 'unknown' }));
});
test('checked-in hosting configuration cannot trigger automatic Git deployments', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, false);
  assert.equal(config.buildCommand, 'npm run build:staging');
});
