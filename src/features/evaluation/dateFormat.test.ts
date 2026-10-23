import { clockTime, dateTime } from './models';

it('formats server timestamps the Figma way and never invents a value', () => {
  expect(dateTime('2026-10-17T06:00:00Z')).toMatch(/^\d{2}\/10\/2026 · \d{2}:\d{2}$/);
  expect(clockTime('2026-10-17T06:00:05Z')).toMatch(/^\d{2}:\d{2}:05$/);
  for (const missing of [null, undefined, '', 'not-a-date']) {
    expect(dateTime(missing)).toBe('Chưa ghi nhận');
    expect(clockTime(missing)).toBe('Chưa ghi nhận');
  }
});
