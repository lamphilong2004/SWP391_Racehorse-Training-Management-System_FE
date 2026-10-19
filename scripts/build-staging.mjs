import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { build, loadEnv } from 'vite';
import { stagingSettings, safeOutput, stagingSourceMetadata } from './staging-policy.mjs';

const profile = process.argv[2] || process.env.RACEHORSE_STAGING_MODE;
const outDir = safeOutput(process.argv[3]);
const configMode = profile === 'preview' ? 'staging-preview' : 'staging-api';
const settings = stagingSettings(profile, { ...loadEnv(configMode, process.cwd(), 'VITE_'), ...process.env });
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim();
const branch = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout?.trim();
const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' });
if (status.status !== 0) throw new Error('Cannot verify the staging worktree state.');
const mainRevision = process.env.RACEHORSE_PREVIEW_MAIN_SHA;
const sourceMetadata = stagingSourceMetadata(process.env, {
  revision, branch, dirty: Boolean(status.stdout.trim()),
  mainIsAncestor: /^[0-9a-f]{40}$/.test(mainRevision ?? '') && spawnSync('git', ['merge-base', '--is-ancestor', mainRevision, revision], { encoding: 'utf8' }).status === 0,
});
Object.assign(process.env, settings.env);
process.env.NODE_ENV = 'production';
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await build({ mode: settings.mode, base: '/', build: { outDir, emptyOutDir: true, sourcemap: false } });
const source = readdirSync(`${outDir}/assets`).filter((file) => file.endsWith('.js')).map((file) => readFileSync(`${outDir}/assets/${file}`, 'utf8')).join('\n');
const files = readdirSync(`${outDir}/assets`);
// Official runtime: no sample store, sample transport, simulated persistence or developer harness in any profile.
for (const forbidden of ['racehorse.business-samples.v1', 'Sample record not found', 'DEV HARNESS', 'PresenterToolsPage', 'demoAuthApi', 'presenter-tools']) {
  if (source.includes(forbidden)) throw new Error(`Staging output contains sample/developer code: ${forbidden}`);
}
if (files.some((file) => /^(sampleTransport|sampleStore|horseSamples|sessionSamples|supportingSamples|managementSamples)-/.test(file))) throw new Error('Staging output contains a sample adapter chunk.');
if (files.some((file) => /^(ComponentsPage|ShellPreviewPage|FoundationV2Page)-/.test(file))) throw new Error('Staging output contains a dev-only review page.');
// Test identities exist only in the protected Preview profile.
if (profile === 'api' && ['Role test sign-in', '@racehorse.test'].some((text) => source.includes(text))) throw new Error('API output contains the role test login.');
writeFileSync(`${outDir}/staging-meta.json`, JSON.stringify({ profile, ...sourceMetadata, builtAt: new Date().toISOString() }, null, 2));
console.log(`STAGING_ARTIFACT_READY profile=${profile} output=${outDir}; not deployed`);
