const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

/** "2023-03-14" or an ISO instant → "14 Mar 2023" (the date format used on the Figma frames). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Whole years between a foaled date and today ("3 yrs"). */
export function ageInYears(foaledDate: string | null | undefined, now = new Date()): number | null {
  if (!foaledDate) return null;
  const [y, m, d] = foaledDate.slice(0, 10).split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age < 0 ? null : age;
}

/** Local calendar date as YYYY-MM-DD (contract `format: date`). */
export function todayIsoDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
