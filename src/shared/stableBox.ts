/**
 * Vietnamese display for stable box codes and yards. The stored codes stay unchanged (they are API values).
 * A one- or two-letter row prefix is a real row name and is kept ("B-07" → "Chuồng B-07"); a longer technical
 * prefix such as PRESENT is dropped ("PRESENT-07" → "Chuồng số 7"). Anything else is shown as "Chuồng <code>".
 */
export function boxLabel(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const value = code.trim();
  if (/^[A-Za-z]{1,2}-\d+$/.test(value)) return `Chuồng ${value.toUpperCase()}`;
  const numbered = value.match(/^[A-Za-z]{3,}-0*(\d+)$/);
  if (numbered) return `Chuồng số ${numbered[1]}`;
  return `Chuồng ${value}`;
}

const YARDS: Record<string, string> = {
  'Illustrative local presentation yard': 'Khu chuồng chính',
  'Isolated integration test': 'Khu chuồng kiểm thử',
};

export function yardLabel(yard: string | null | undefined): string | null {
  if (!yard?.trim()) return null;
  return YARDS[yard.trim()] ?? yard.trim();
}

/** Row heading for the box picker: only real one- or two-letter rows get a "Dãy" heading. */
export function boxRow(code: string): string {
  const prefix = code.includes('-') ? code.split('-')[0] : '';
  return /^[A-Za-z]{1,2}$/.test(prefix) ? prefix.toUpperCase() : '';
}
