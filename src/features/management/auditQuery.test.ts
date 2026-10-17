import { auditSearchParams, filtersFromQuery, isAuditDate, queryFromFilters, readAuditQuery, validateAuditQuery } from './auditQuery';

describe('CORE-052 audit filters', () => {
  it('defaults to a zero-based page of 20', () => {
    expect(readAuditQuery(new URLSearchParams())).toEqual({ page: 0, size: 20 });
  });
  it('round-trips API filters through the URL without introducing search or role', () => {
    const query = { actor: 12, action: 'A&B', targetType: 'HORSE', from: '2026-10-01T06:00:00Z', page: 3, size: 10 };
    expect(readAuditQuery(auditSearchParams(query))).toEqual(query);
    expect([...auditSearchParams({ ...query, pageSearch: 'name', pageRole: 'GROOM' } as typeof query).keys()]).not.toContain('pageSearch');
  });
  it.each(['-1', '1.5', '0x10', '1e2', 'oops', '', '9007199254740992'])('rejects invalid actor input %s', (actor) => {
    expect(validateAuditQuery(readAuditQuery(new URLSearchParams({ actor })))).toHaveProperty('actor');
  });
  it.each(['2026-02-30T10:00:00Z', '2026-13-01T00:00:00Z', '2026-10-01', '2026-10-01T24:00:00Z', 'not-a-date'])('rejects invalid calendar/time %s', (date) => {
    expect(isAuditDate(date)).toBe(false);
  });
  it('accepts leap day/offsets and compares absolute instants', () => {
    expect(isAuditDate('2024-02-29T12:30:00+07:00')).toBe(true);
    expect(validateAuditQuery({ page: 0, size: 20, from: '2026-10-17T13:00:00+07:00', to: '2026-10-17T05:59:00Z' })).toHaveProperty('to');
  });
  it('validates limits for free action/entity codes instead of assuming a finalized action vocabulary', () => {
    expect(validateAuditQuery({ page: 0, size: 20, action: 'X'.repeat(101), targetType: 'Y'.repeat(51) })).toMatchObject({ action: expect.any(String), targetType: expect.any(String) });
    expect(validateAuditQuery({ page: 0, size: 20, action: 'FUTURE_APPROVED_ACTION' })).toEqual({});
  });
  it('converts local date input to UTC and resets server pagination when applying filters', () => {
    const query = queryFromFilters({ actor: '12', action: ' ACTION ', targetType: ' HORSE ', from: '2026-10-01T10:30', to: '' }, 50);
    expect(query).toMatchObject({ actor: 12, action: 'ACTION', targetType: 'HORSE', from: new Date('2026-10-01T10:30').toISOString(), page: 0, size: 50 });
    expect(filtersFromQuery(query).from).toBe('2026-10-01T10:30');
  });
  it('does not normalize an impossible local calendar date', () => {
    const query = queryFromFilters({ actor: '', action: '', targetType: '', from: '2026-02-30T10:30', to: '' }, 20);
    expect(validateAuditQuery(query)).toHaveProperty('from');
  });
});
