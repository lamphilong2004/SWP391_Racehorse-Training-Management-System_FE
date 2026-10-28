import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clubDate, clubDateTime, parseClubDateTime, sessionPeriodError } from './clubCalendar';
import { useClubToday } from './useClubToday';

afterEach(() => vi.useRealTimers());

describe('club scheduling calendar', () => {
  it('uses Vietnam midnight independently of browser timezone and rejects impossible dates', () => {
    expect(clubDate(new Date('2026-10-27T17:00:00Z'))).toBe('2026-10-28');
    expect(clubDateTime(new Date('2026-10-27T17:30:00Z'))).toBe('2026-10-28T00:30');
    expect(parseClubDateTime('2026-10-28T00:30')?.toISOString()).toBe('2026-10-27T17:30:00.000Z');
    expect(parseClubDateTime('2026-02-30T10:00')).toBeNull();
    expect(parseClubDateTime('')).toBeNull();
  });

  it('rejects past and current times, accepts a later time today, and checks both end boundaries', () => {
    const now = new Date('2026-10-27T06:00:00Z');
    const phase = { startDate: '2026-10-27', endDate: '2026-10-28' };
    const program = { periodStart: '2026-10-27', periodEnd: '2026-10-28' };
    expect(sessionPeriodError(now, undefined, phase, program, now)).toMatch(/tương lai/);
    expect(sessionPeriodError(new Date('2026-10-27T05:00Z'), undefined, phase, program, now)).toMatch(/tương lai/);
    expect(sessionPeriodError(new Date('2026-10-27T07:00Z'), undefined, phase, program, now)).toBeNull();
    expect(sessionPeriodError(new Date('2026-10-28T16:00Z'), new Date('2026-10-28T18:00Z'), phase, program, now)).toMatch(/giai đoạn/);
    expect(sessionPeriodError(new Date('2026-10-28T16:00Z'), new Date('2026-10-28T18:00Z'), undefined, program, now)).toMatch(/chương trình/);
  });

  it('rolls the Today view over at club midnight and catches up after browser sleep', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T16:59:59Z'));
    const { result, unmount } = renderHook(useClubToday);
    expect(result.current).toBe('2026-10-27');
    act(() => vi.advanceTimersByTime(1100));
    expect(result.current).toBe('2026-10-28');
    vi.setSystemTime(new Date('2026-10-29T01:00Z'));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(result.current).toBe('2026-10-29');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
