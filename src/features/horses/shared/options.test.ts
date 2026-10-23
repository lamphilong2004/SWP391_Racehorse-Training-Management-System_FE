import { sexLabel } from './options';

it('shows stored free-text sex in title case without inventing a value', () => {
  expect(sexLabel('MALE')).toBe('Đực');
  expect(sexLabel('gelding')).toBe('Ngựa thiến');
  expect(sexLabel('RIDGLING / CRYPTORCHID')).toBe('Ridgling / Cryptorchid');
  expect(sexLabel('  ')).toBeNull();
  expect(sexLabel(null)).toBeNull();
});
