/** Public FE configuration only; never a credential or a replacement for Backend authorization. */
export function resolveApiBase(configured: string | undefined, development = false): string {
  const value = configured?.trim();
  if (!value) return '';
  if (value === '/') return '';
  if (development) return value.replace(/\/$/, '');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Production API base must be / or a public HTTPS origin.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) ||
    /^\[(?:::|::1|::ffff:|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/.test(host)) {
    throw new Error('Production API base must be / or a public HTTPS origin without credentials, path or query.');
  }
  return url.origin;
}
