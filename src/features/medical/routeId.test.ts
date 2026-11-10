import { isPositiveIdParam } from './routeId';

it('accepts multi-digit case ids so the Groom list loads on every real case (BR-32 regression)', () => {
  for (const id of ['9', '57', '120', '1000']) expect(isPositiveIdParam(id)).toBe(true);
  for (const id of ['', '0', '07', '-1', 'abc', '5x', '1.5']) expect(isPositiveIdParam(id)).toBe(false);
});
