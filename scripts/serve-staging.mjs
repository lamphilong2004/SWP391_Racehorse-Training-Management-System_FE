import process from 'node:process';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

// Local static-host rehearsal only. No Vite dev server, backend proxy or public network binding.
const root = resolve(process.argv[2] || 'dist-staging'), port = Number(process.argv[3] || 5196);
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function fileFor(name) {
  const file = resolve(root, `.${name}`);
  if (!file.startsWith(root + sep)) return null;
  try { return statSync(file).isFile() ? file : null; } catch { return null; }
}
createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let file = fileFor(pathname);
  if (!file && config.rewrites.some((rule) => new RegExp(`^${rule.source}$`).test(pathname))) file = fileFor('/index.html');
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
  const headers = { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  for (const rule of config.headers) if (new RegExp(`^${rule.source}$`).test(pathname)) for (const header of rule.headers) headers[header.key] = header.value;
  res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`STATIC_STAGING_REHEARSAL http://127.0.0.1:${port} root=${root}`));
