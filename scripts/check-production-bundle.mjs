// Fails the production build when the bundle carries sample, developer or test-identity code.
// Production is built from `main` with `npm run build`; JWT/RBAC stay enforced by the real API client.
import { readdirSync, readFileSync } from 'node:fs';

const outDir = process.argv[2] || 'dist';
const files = readdirSync(`${outDir}/assets`);
const source = files.filter((file) => file.endsWith('.js')).map((file) => readFileSync(`${outDir}/assets/${file}`, 'utf8')).join('\n');

const forbidden = [
  'racehorse.business-samples.v1', 'Sample record not found', 'DEV HARNESS', 'PresenterToolsPage', 'demoAuthApi', 'presenter-tools',
  'Role test sign-in', '@racehorse.test', 'Protected test sign-in', 'UI fixture preview',
  'http://localhost:8080', 'ws://localhost:8080',
];
const found = forbidden.filter((text) => source.includes(text));
if (found.length) throw new Error(`Production bundle contains test/sample/developer code: ${found.join(', ')}`);
if (files.some((file) => /^(sampleTransport|sampleStore|horseSamples|sessionSamples|supportingSamples|managementSamples|RoleTestEntry|roleTestAuthApi|ComponentsPage|ShellPreviewPage)-/.test(file))) {
  throw new Error('Production bundle contains a sample, role-test or dev-only chunk.');
}
console.log(`PRODUCTION_BUNDLE_OK output=${outDir}`);
