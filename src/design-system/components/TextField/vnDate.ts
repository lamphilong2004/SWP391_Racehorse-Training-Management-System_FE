/** Vietnamese date/time text for date, datetime-local and time inputs (Leader request 11/11). The value the form
 * receives stays ISO ("2026-11-11", "2026-11-11T09:30", "09:30"); only the text the user reads and types changes. */
export type VnDateKind = 'date' | 'datetime-local' | 'time';

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const validTime = (h: number, min: number) => h >= 0 && h <= 23 && min >= 0 && min <= 59;

/** ISO → display text ("" when empty or not ISO). */
export function formatVn(kind: VnDateKind, iso: string | undefined | null): string {
  if (!iso) return '';
  if (kind === 'time') { const m = /^(\d{2}):(\d{2})/.exec(iso); return m ? `${m[1]}:${m[2]}` : ''; }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return '';
  const day = `${m[3]}/${m[2]}/${m[1]}`;
  return kind === 'datetime-local' ? `${day} ${m[4] ?? '00'}:${m[5] ?? '00'}` : day;
}

/** Display text (dd/mm/yyyy[ HH:mm] or HH:mm) or ISO → ISO; "" when empty; null when incomplete/invalid. */
export function parseVn(kind: VnDateKind, text: string): string | null {
  const t = text.trim();
  if (!t) return '';
  if (kind === 'time') {
    const m = /^(\d{1,2})[:hH.](\d{2})$/.exec(t);
    return m && validTime(+m[1], +m[2]) ? `${pad(+m[1])}:${m[2]}` : null;
  }
  let y: number, mo: number, d: number, h = 0, mi = 0, hasTime = false;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(t);
  const vn = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2})[:hH](\d{2}))?$/.exec(t);
  if (iso) { [y, mo, d] = [+iso[1], +iso[2], +iso[3]]; if (iso[4]) { h = +iso[4]; mi = +iso[5]; hasTime = true; } }
  else if (vn) { [d, mo, y] = [+vn[1], +vn[2], +vn[3]]; if (vn[4]) { h = +vn[4]; mi = +vn[5]; hasTime = true; } }
  else return null;
  if (!validDate(y, mo, d)) return null;
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (kind === 'date') return date;
  if (!hasTime || !validTime(h, mi)) return null;
  return `${date}T${pad(h)}:${pad(mi)}`;
}

export const placeholderVn = (kind: VnDateKind) => (kind === 'time' ? 'HH:mm' : kind === 'datetime-local' ? 'dd/mm/yyyy HH:mm' : 'dd/mm/yyyy');
