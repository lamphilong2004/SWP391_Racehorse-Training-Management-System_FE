import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const base = '985808c90a8f9c5cba018a6b58a5f6c462ebd9dd';
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const original = path => execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
for (const path of [
  'src/app/router.tsx', 'src/app/RequireAuth.tsx', 'src/layout/navigation.ts',
  'src/shared/auth/AuthProvider.tsx', 'src/shared/auth/authApi.ts', 'src/shared/auth/authSession.ts',
  'src/shared/data/businessData.ts', 'src/features/horses/api/horsesApi.ts',
  'src/features/program-creation/programApi.ts', 'src/features/restrictions/restrictionApi.ts',
  'src/features/trainer-session/sessionApi.ts', 'vite.config.ts', 'vercel.json',
]) test(`${path}: approved main behavior preserved`, () => assert.equal(read(path), original(path)));
test('table toolbar owns no business requests, identity, storage or fallback', () => {
  const source = read('src/design-system/components/TableToolbar/TableToolbar.tsx');
  assert(!/fetch\(|requestApi|localStorage|sessionStorage|sampleStore|accessToken/.test(source));
  assert.match(source, /type="button"/); assert.match(source, /resultCount !== undefined/);
  assert.match(source, /Chỉ lọc dữ liệu trên trang/);
});
test('draft readiness, lifecycle, health and availability remain independent', () => {
  const source = read('src/features/horses/HorsePages.tsx');
  for (const family of ['lifecycle', 'health', 'availability']) assert(source.includes(`family="${family}"`));
  assert.match(source, /h.lifecycle === 'DRAFT'/); assert.match(source, /chưa đủ điều kiện vận hành/);
});
test('text/action palette retains WCAG AA contrast on white', () => {
  const luminance = hex => {
    const rgb = hex.match(/[0-9a-f]{2}/gi).map(n => parseInt(n, 16) / 255)
      .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const color of ['047857', '065f46', '0369a1', '0b132b', '7c3aed']) assert(1.05 / (luminance(color) + .05) >= 4.5, color);
});
