import { resolveApiBase } from './apiOrigin';

it('uses same-origin requests for an unconfigured production shell, never a visitor localhost', () => {
  expect(resolveApiBase(undefined)).toBe(''); expect(resolveApiBase('')).toBe(''); expect(resolveApiBase('/')).toBe('');
});
it('retains explicit local development origins and proxies', () => {
  expect(resolveApiBase('http://127.0.0.1:18086/', true)).toBe('http://127.0.0.1:18086');
  expect(resolveApiBase('/', true)).toBe('');
});
it('accepts a public HTTPS origin and normalizes its trailing slash', () => {
  expect(resolveApiBase('https://api.example.test/')).toBe('https://api.example.test');
});
it.each(['http://api.example.test', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.2', 'https://192.168.1.2', 'https://172.16.0.1', 'https://[::1]', 'https://[fd00::1]', 'https://host.local', 'https://user:fixture@api.example.test', 'https://api.example.test/api', 'https://api.example.test?token=fixture', 'https://api.example.test/#fixture', 'not-a-url'])('rejects unsafe production configuration without echoing %s', (value) => {
  expect(() => resolveApiBase(value)).toThrow(/Production API base/);
});
