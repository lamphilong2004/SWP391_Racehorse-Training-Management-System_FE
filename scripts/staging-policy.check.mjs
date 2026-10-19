import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeOutput, stagingSettings } from './staging-policy.mjs';

test('sample builds are retired; Preview uses the real API client with a role test login', () => {
  assert.throws(() => stagingSettings('sample', {}), /retired/);
  assert.deepEqual(stagingSettings('preview', {}).env, { VITE_ROLE_TEST_LOGIN: 'true', VITE_BUSINESS_DATA_SOURCE: 'api', VITE_API_BASE_URL: '/', VITE_API_PROXY_TARGET: '' });
  assert.equal(stagingSettings('preview', { VITE_API_BASE_URL: 'https://api.example.test' }).env.VITE_API_BASE_URL, 'https://api.example.test');
  assert.throws(() => stagingSettings('preview', { VITE_API_BASE_URL: 'http://api.example.test' }));
});
test('API build requires HTTPS and rejects localhost/private or credential-bearing URLs', () => {
  for (const url of [undefined, '/', 'http://api.example.test', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://user:secret@api.example.test', 'https://api.example.test/api', 'https://api.example.test?token=test']) assert.throws(() => stagingSettings('api', { VITE_API_BASE_URL: url }));
  assert.equal(stagingSettings('api', { VITE_API_BASE_URL: 'https://api.example.test' }).env.VITE_API_BASE_URL, 'https://api.example.test');
});
test('every staging build rejects sample flags, and API builds reject the role test login', () => {
  for (const profile of ['preview', 'api']) {
    for (const key of ['VITE_STAGING_SAMPLE', 'VITE_DEMO_UI_ONLY']) assert.throws(() => stagingSettings(profile, { VITE_API_BASE_URL: 'https://api.example.test', [key]: 'true' }));
    assert.throws(() => stagingSettings(profile, { VITE_API_BASE_URL: 'https://api.example.test', VITE_BUSINESS_DATA_SOURCE: 'sample' }));
  }
  assert.throws(() => stagingSettings('api', { VITE_API_BASE_URL: 'https://api.example.test', VITE_ROLE_TEST_LOGIN: 'true' }));
});
test('unknown profile and output escape are rejected', () => {
  assert.throws(() => stagingSettings(undefined, {}));
  assert.throws(() => safeOutput('../outside'));
  assert.equal(safeOutput('dist-staging-preview'), 'dist-staging-preview');
  assert.throws(() => safeOutput('dist-staging-sample'));
});

const production = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), RACEHORSE_APPROVED_RELEASE_SHA: 'a'.repeat(40), VITE_API_BASE_URL: 'https://api.racehorse.vn' };
test('staging profiles never build Production; main uses npm run build', () => {
  for (const profile of ['sample', 'preview', 'api']) assert.throws(() => stagingSettings(profile, production));
});
test('Preview accepts only the integration branch; local builds still work', () => {
  for (const profile of ['preview', 'api']) {
    assert.doesNotThrow(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'integration/fe-product-main' }));
    for (const branch of [undefined, 'main', 'dev']) assert.throws(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: branch }));
  }
  assert.throws(() => stagingSettings('api', { ...production, VERCEL_ENV: 'unknown' }));
});
test('checked-in hosting configuration auto-deploys only main with the production build', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.git.deploymentEnabled, { main: true, '**': false });
  assert.equal(config.framework, 'vite');
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.ok(config.rewrites.some((rule) => rule.destination === '/index.html'));
});
