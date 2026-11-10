import { formatVn, parseVn } from './vnDate';

it('shows dates and times the Vietnamese way and keeps ISO values for the API', () => {
  expect(formatVn('date', '2026-11-11')).toBe('11/11/2026');
  expect(formatVn('datetime-local', '2026-11-11T09:30')).toBe('11/11/2026 09:30');
  expect(formatVn('time', '09:30')).toBe('09:30');
  expect(parseVn('date', '11/11/2026')).toBe('2026-11-11');
  expect(parseVn('date', '1/2/2026')).toBe('2026-02-01');
  expect(parseVn('date', '2026-11-11')).toBe('2026-11-11');
  expect(parseVn('datetime-local', '11/11/2026 9:30')).toBe('2026-11-11T09:30');
  expect(parseVn('time', '7:05')).toBe('07:05');
  expect(parseVn('date', '')).toBe('');
  for (const bad of ['31/02/2026', '11/13/2026', '11/11', 'abc']) expect(parseVn('date', bad)).toBeNull();
  expect(parseVn('time', '24:00')).toBeNull();
});
