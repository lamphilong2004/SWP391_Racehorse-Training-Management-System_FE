import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Read-only static-host verification. Authentication, role authority and SQL writes are not proved here.
const origin = new URL(process.argv[2]);
assert(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)), 'Use HTTPS or a local loopback rehearsal.');
assert(!origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === '/', 'Use a plain origin, without credentials.');
const deepLinks = ['/', '/login', '/dashboard', '/horses', '/horses/7', '/horses/new', '/training/programs/new', '/training/my-sessions/44/pre-check', '/rider', '/training/sessions/43/evaluation', '/training/performance', '/medical/cases/501', '/medical/my-tasks', '/admin/audit-log', '/notifications', '/my-horses'];
let shell;
const pages = [];
for (const path of deepLinks) {
  const response = await fetch(new URL(path, origin));
  const html = await response.text();
  assert.equal(response.status, 200, `SPA deep link failed: ${path}`);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /id="root"/);
  shell ??= html;
  assert.equal(html, shell, `Different SPA document at ${path}`);
  pages.push({ path, status: response.status });
}
const pending = new Set([...shell.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]));
assert(pending.size > 0, 'No assets in the SPA document.');
const assets = [], visited = new Set();
let javascript = '';
for (const path of pending) {
  if (visited.has(path)) continue;
  assert(visited.size < 180, 'Unexpected asset graph size.');
  visited.add(path);
  const url = new URL(path, origin);
  assert(url.origin === origin.origin && url.pathname.startsWith('/assets/'), 'Assets must remain on the inspected origin.');
  const response = await fetch(url);
  assert.equal(response.status, 200, `Asset failed: ${path}`);
  assert.doesNotMatch(response.headers.get('content-type') || '', /text\/html/, `Asset returned HTML: ${path}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  assets.push({ path, status: response.status, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
  if (/\.(?:css|js)$/.test(path)) {
    const text = buffer.toString('utf8');
    if (path.endsWith('.js')) javascript += text;
    for (const match of text.matchAll(/["'(]((?:\.\/|\/?assets\/)?[\w.-]+\.(?:js|css|woff2?|svg|png|jpe?g))["')]/g)) {
      const child = match[1].startsWith('assets/') ? new URL(`/${match[1]}`, origin) : new URL(match[1], url);
      if (child.origin === origin.origin && child.pathname.startsWith('/assets/')) pending.add(child.pathname);
    }
  }
}
const forbidden = ['racehorse.business-samples.v1', 'Sample record not found', 'DEV HARNESS', 'Role test sign-in', '@racehorse.test', 'http://localhost:8080', 'ws://localhost:8080'];
assert.deepEqual(forbidden.filter(marker => javascript.includes(marker)), [], 'Production contains sample, role-test, harness or visitor-localhost code.');
const exclusions = [];
for (const path of ['/assets/does-not-exist.js', '/.env', '/package.json']) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 404, `Excluded path exposed: ${path}`); exclusions.push({ path, status: response.status });
}
const health = await fetch(new URL('/api/health', origin));
const report = { result: 'PASS', evidence: 'Static HTTPS assets/deep links only; no live authentication or Backend/SQL proof', origin: origin.origin,
  pages, assets, exclusions, apiHealthStatus: health.status, fontAssets: assets.filter(asset => /\.woff2?$/.test(asset.path)).length,
  inlineSvgAssetPresent: javascript.includes('data:image/svg'), testedAt: new Date().toISOString() };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, assets: assets.length }));
