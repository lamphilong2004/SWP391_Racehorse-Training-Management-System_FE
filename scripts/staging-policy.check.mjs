import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { MAIN_PREVIEW_BRANCH, safeOutput, stagingSettings, stagingSourceMetadata } from './staging-policy.mjs';

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
test('Preview retains the historical integration route but rejects main, dev and arbitrary source branches', () => {
  for (const profile of ['preview', 'api']) {
    assert.doesNotThrow(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'integration/fe-product-main' }));
    for (const branch of [undefined, 'main', 'dev', 'feat/unreviewed']) assert.throws(() => stagingSettings(profile, { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: branch }));
  }
  assert.throws(() => stagingSettings('api', { ...production, VERCEL_ENV: 'unknown' }));
});

const mainPreview = { ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: MAIN_PREVIEW_BRANCH, RACEHORSE_PREVIEW_EXPECTED_SHA: 'a'.repeat(40), RACEHORSE_PREVIEW_MAIN_SHA: 'b'.repeat(40) };
test('the explicit main-source Preview requires both full pins and the exact hosting SHA', () => {
  for (const profile of ['preview', 'api']) {
    assert.doesNotThrow(() => stagingSettings(profile, mainPreview));
    for (const key of ['RACEHORSE_PREVIEW_EXPECTED_SHA', 'RACEHORSE_PREVIEW_MAIN_SHA']) {
      for (const value of [undefined, '', 'bfa8147', 'g'.repeat(40), 'A'.repeat(40)]) assert.throws(() => stagingSettings(profile, { ...mainPreview, [key]: value }), /full lowercase/);
    }
    assert.throws(() => stagingSettings(profile, { ...mainPreview, VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40) }), /deployment SHA/);
    assert.throws(() => stagingSettings(profile, { ...mainPreview, VERCEL_ENV: 'production' }), /never build Production/);
    assert.throws(() => stagingSettings(profile, { ...mainPreview, VITE_BUSINESS_DATA_SOURCE: 'sample' }), /sample\/harness/);
  }
});
const verifiedCheckout = { revision: 'a'.repeat(40), branch: MAIN_PREVIEW_BRANCH, mainIsAncestor: true, gitVerified: true, dirty: false };
test('Preview source uses verified deployment metadata for matching, synthetic master and detached checkout names', () => {
  // The internal label does not grant authority: every case still needs the same Git proof and full pins.
  for (const branch of [MAIN_PREVIEW_BRANCH, 'master', '', 'internal-build-checkout']) {
    assert.deepEqual(stagingSourceMetadata(mainPreview, { ...verifiedCheckout, branch }), { revision: verifiedCheckout.revision, sourceBranch: MAIN_PREVIEW_BRANCH, sourceMainRevision: 'b'.repeat(40), workingTreeDirty: false, sourceKind: 'main-snapshot' });
  }
});
test('Preview rejects actual Git revision, hosting SHA and expected pin mismatches', () => {
  for (const branch of [MAIN_PREVIEW_BRANCH, 'master', '']) {
    const checkout = { ...verifiedCheckout, branch };
    assert.throws(() => stagingSourceMetadata(mainPreview, { ...checkout, revision: 'c'.repeat(40) }), /actual Git checkout/);
    assert.throws(() => stagingSourceMetadata({ ...mainPreview, VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40) }, checkout), /deployment SHA/);
    assert.throws(() => stagingSourceMetadata({ ...mainPreview, RACEHORSE_PREVIEW_EXPECTED_SHA: 'c'.repeat(40) }, checkout), /deployment SHA/);
  }
});
test('Preview rejects invalid or missing hosting branch metadata even for an internal master checkout', () => {
  for (const branch of [undefined, '', 'master', 'main', 'dev', 'feat/unreviewed', `${MAIN_PREVIEW_BRANCH}-other`]) {
    assert.throws(() => stagingSourceMetadata({ ...mainPreview, VERCEL_GIT_COMMIT_REF: branch }, { ...verifiedCheckout, branch: 'master' }), /Preview builds require/);
  }
});
test('Preview fails closed on missing, mismatched or unknown main ancestry', () => {
  for (const mainIsAncestor of [false, undefined, null, 'true', 1]) {
    assert.throws(() => stagingSourceMetadata(mainPreview, { ...verifiedCheckout, branch: 'master', mainIsAncestor }), /verified ancestor/);
  }
});
test('Preview rejects dirty and unknown Git worktree state', () => {
  assert.throws(() => stagingSourceMetadata(mainPreview, { ...verifiedCheckout, dirty: true }), /clean Git checkout/);
  for (const dirty of [undefined, null, '', 0, 'false']) assert.throws(() => stagingSourceMetadata(mainPreview, { ...verifiedCheckout, dirty }), /worktree state/);
});
test('Preview requires successful Git probes and a known full actual revision, not metadata alone', () => {
  for (const gitVerified of [undefined, false, null, 'true', 1]) assert.throws(() => stagingSourceMetadata(mainPreview, { ...verifiedCheckout, gitVerified }), /Preview Git source/);
  for (const revision of [undefined, '', 'a'.repeat(7), 'A'.repeat(40), 'g'.repeat(40)]) assert.throws(() => stagingSourceMetadata(mainPreview, { ...verifiedCheckout, revision }), /checkout SHA/);
  assert.throws(() => stagingSourceMetadata(mainPreview), /Preview Git source/);
  assert.throws(() => stagingSourceMetadata({ ...mainPreview, VERCEL_GIT_COMMIT_SHA: undefined }, verifiedCheckout), /deployment SHA/);
  for (const key of ['RACEHORSE_PREVIEW_EXPECTED_SHA', 'RACEHORSE_PREVIEW_MAIN_SHA']) assert.throws(() => stagingSourceMetadata({ ...mainPreview, [key]: undefined }, verifiedCheckout), /full lowercase/);
});
test('a local rehearsal records its real branch without pretending it is a hosted Preview or fetching main', () => {
  const checkout = { revision: 'a'.repeat(40), branch: 'feat/local-work', mainIsAncestor: true, dirty: true };
  const local = { ...mainPreview, VERCEL_ENV: undefined };
  assert.deepEqual(stagingSourceMetadata(local, checkout), { revision: checkout.revision, sourceBranch: checkout.branch, sourceMainRevision: 'b'.repeat(40), workingTreeDirty: true, sourceKind: 'main-snapshot' });
  assert.throws(() => stagingSourceMetadata({ ...local, RACEHORSE_PREVIEW_EXPECTED_SHA: 'c'.repeat(40) }, checkout), /checkout SHA/);
  assert.deepEqual(stagingSourceMetadata({}, checkout), { revision: checkout.revision, sourceBranch: checkout.branch, sourceMainRevision: null, workingTreeDirty: true, sourceKind: 'local' });
});
test('historical integration metadata never claims to be a current main snapshot', () => {
  const source = stagingSourceMetadata({ ...production, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'integration/fe-product-main' }, { ...verifiedCheckout, branch: 'integration/fe-product-main' });
  assert.equal(source.sourceKind, 'historical-integration'); assert.equal(source.sourceMainRevision, null);
  assert.throws(() => stagingSourceMetadata({ ...mainPreview, VERCEL_GIT_COMMIT_REF: 'integration/fe-product-main' }, verifiedCheckout), /pins apply only/);
});
const expectedProductionConfig = {
    $schema: 'https://openapi.vercel.sh/vercel.json', framework: 'vite', installCommand: 'npm ci', buildCommand: 'npm run build', outputDirectory: 'dist',
    git: { deploymentEnabled: { main: true, '**': false } },
    rewrites: [{ source: '/((?!api(?:/|$)|assets(?:/|$)|.*\\.[^/]+$).*)', destination: '/index.html' }],
    headers: [
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'no-cache' },
      ] },
      { source: '/index.html', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ],
};
const expectedPreviewConfig = {
  ...expectedProductionConfig,
  buildCommand: 'npm run build:staging:preview',
  outputDirectory: 'dist-staging',
  git: { deploymentEnabled: false },
};
function expectedHostingConfig(actualBranch, env = {}, checkout = {}) {
  // Hosted Preview uses the same proven source as the build; local and Production policy stay unchanged.
  const branch = env.VERCEL_ENV === 'preview' ? stagingSourceMetadata(env, { ...checkout, branch: actualBranch }).sourceBranch : actualBranch;
  return branch === MAIN_PREVIEW_BRANCH ? expectedPreviewConfig : expectedProductionConfig;
}

test('checked-in hosting configuration exactly matches its actual Git branch policy', () => {
  const git = spawnSync('git', ['branch', '--show-current'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(git.status, 0, 'Git branch verification must succeed before accepting hosting configuration.');
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' });
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config, expectedHostingConfig(git.stdout.trim(), process.env, {
    revision: revision.stdout?.trim(), gitVerified: revision.status === 0 && status.status === 0,
    dirty: Boolean(status.stdout?.trim()), mainIsAncestor: spawnSync('git', ['merge-base', '--is-ancestor', process.env.RACEHORSE_PREVIEW_MAIN_SHA || '', 'HEAD'], { encoding: 'utf8' }).status === 0,
  }));
});

test('only proven hosted Preview source or the dedicated local branch accepts the exact Preview config; Production is unchanged', () => {
  for (const branch of ['main', 'dev', 'integration/fe-product-main', 'feat/local-work', 'preview/role-test-main-other', '']) {
    assert.deepEqual(expectedHostingConfig(branch), expectedProductionConfig);
    assert.throws(() => assert.deepEqual(expectedPreviewConfig, expectedHostingConfig(branch)));
  }
  assert.deepEqual(expectedHostingConfig(MAIN_PREVIEW_BRANCH), expectedPreviewConfig);
  assert.throws(() => assert.deepEqual(expectedProductionConfig, expectedHostingConfig(MAIN_PREVIEW_BRANCH)));
  assert.throws(() => expectedHostingConfig('master', { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: MAIN_PREVIEW_BRANCH }), /full lowercase/);
  for (const branch of ['master', MAIN_PREVIEW_BRANCH, '']) assert.deepEqual(expectedHostingConfig(branch, mainPreview, verifiedCheckout), expectedPreviewConfig);
  assert.throws(() => expectedHostingConfig('master', { ...mainPreview, VERCEL_GIT_COMMIT_REF: 'main' }, verifiedCheckout), /Preview builds require/);
  assert.throws(() => expectedHostingConfig('master', mainPreview, { ...verifiedCheckout, gitVerified: false }), /Preview Git source/);
  assert.deepEqual(expectedHostingConfig('', { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: MAIN_PREVIEW_BRANCH }), expectedProductionConfig);
  assert.throws(() => assert.deepEqual({ ...expectedPreviewConfig, buildCommand: 'npm run build' }, expectedHostingConfig(MAIN_PREVIEW_BRANCH)));
  assert.throws(() => assert.deepEqual({ ...expectedPreviewConfig, git: { deploymentEnabled: true } }, expectedHostingConfig(MAIN_PREVIEW_BRANCH)));
});

test('the separate manual Preview template exactly preserves routing and headers while disabling automatic deployments', () => {
  const previewConfig = JSON.parse(readFileSync(new URL('../vercel.preview.json', import.meta.url), 'utf8'));
  assert.deepEqual(previewConfig, expectedPreviewConfig);
  assert.notEqual(previewConfig.buildCommand, expectedProductionConfig.buildCommand);
  assert.notEqual(previewConfig.outputDirectory, expectedProductionConfig.outputDirectory);
});
