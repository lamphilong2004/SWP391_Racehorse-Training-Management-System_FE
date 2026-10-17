import test from 'node:test';
import assert from 'node:assert/strict';
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
