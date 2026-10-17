import process from 'node:process';
import assert from 'node:assert/strict';

// Read-only HTTP checks. UI/RBAC/mutation smoke tests live in src/staging/stagingSmoke.test.tsx.
const base = new URL(process.argv[2] || process.env.STAGING_URL || 'http://127.0.0.1:5196');
assert(!base.username && !base.password && !base.search && !base.hash, 'Use a plain staging origin; never put credentials in the URL.');
assert(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)), 'Remote staging must use HTTPS.');
const paths = ['/login', '/dashboard', '/horses', '/horses/7', '/horses/new', '/training/programs/new', '/training/my-sessions/44/pre-check', '/rider', '/training/sessions/43/evaluation', '/training/performance', '/medical/cases/501', '/medical/my-tasks', '/admin/audit-log', '/notifications', '/my-horses'];
let shell;
for (const path of paths) {
  const response = await fetch(new URL(path, base), { redirect: 'follow' });
  assert.equal(response.status, 200, `${path}: expected SPA shell (check deployment protection if redirected).`);
  const html = await response.text();
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /id="root"/);
  assert.match(html, /type="module"/);
  shell ??= html;
  assert.equal(html, shell, `${path}: inconsistent SPA document`);
}
const script = /<script[^>]+src="([^"]+)"/.exec(shell)?.[1];
assert(script, 'Missing entry script');
const entry = await fetch(new URL(script, base));
assert.equal(entry.status, 200); assert.match(entry.headers.get('content-type') || '', /javascript/);
const metaResponse = await fetch(new URL('/staging-meta.json', base));
assert.equal(metaResponse.status, 200);
const meta = await metaResponse.json();
assert(['sample', 'api'].includes(meta.profile));
for (const path of ['/assets/does-not-exist.js', '/api/health', '/.env', '/package.json']) assert.equal((await fetch(new URL(path, base))).status, 404, `${path} must not return an HTML false-success.`);
console.log(JSON.stringify({ result: 'STATIC_HTTP_SMOKE_PASS', profile: meta.profile, revision: meta.revision, deepLinks: paths.length, entryAsset: script, uiRbacAndBackendNotProven: true }, null, 2));
