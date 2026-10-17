import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { build, loadEnv } from 'vite';
import { stagingSettings, safeOutput } from './staging-policy.mjs';

const profile = process.argv[2] || process.env.RACEHORSE_STAGING_MODE;
const outDir = safeOutput(process.argv[3]);
const configMode = profile === 'sample' ? 'staging-sample' : 'staging-api';
const settings = stagingSettings(profile, { ...loadEnv(configMode, process.cwd(), 'VITE_'), ...process.env });
Object.assign(process.env, settings.env);
process.env.NODE_ENV = 'production';
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await build({ mode: settings.mode, base: '/', build: { outDir, emptyOutDir: true, sourcemap: false } });
const source = readdirSync(`${outDir}/assets`).filter((file) => file.endsWith('.js')).map((file) => readFileSync(`${outDir}/assets/${file}`, 'utf8')).join('\n');
for (const forbidden of ['DEV HARNESS — SAMPLE DATA', 'PresenterToolsPage', 'demoAuthApi', 'presenter-tools']) {
  if (source.includes(forbidden)) throw new Error(`Staging output contains a developer-only tool: ${forbidden}`);
}
if (profile === 'api' && source.includes('Explore sample workspace')) throw new Error('API output contains sample identity entry.');
const revision = process.env.VERCEL_GIT_COMMIT_SHA || spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || null;
writeFileSync(`${outDir}/staging-meta.json`, JSON.stringify({ profile, revision, builtAt: new Date().toISOString() }, null, 2));
console.log(`STAGING_ARTIFACT_READY profile=${profile} output=${outDir}; not deployed`);
