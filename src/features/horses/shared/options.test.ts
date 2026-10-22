import { sexLabel } from './options';

it('shows stored free-text sex in title case without inventing a value', () => {
  expect(sexLabel('MALE')).toBe('Male');
  expect(sexLabel('gelding')).toBe('Gelding');
  expect(sexLabel('RIDGLING / CRYPTORCHID')).toBe('Ridgling / Cryptorchid');
  expect(sexLabel('  ')).toBeNull();
  expect(sexLabel(null)).toBeNull();
});
