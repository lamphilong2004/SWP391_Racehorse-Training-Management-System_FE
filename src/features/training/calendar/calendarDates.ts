export function calendarPeriod(anchor: Date, view: 'week' | 'month') {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (view === 'month') start.setDate(1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; });
  const end = new Date(days.at(-1)!); end.setHours(23, 59, 59, 999);
  return { days, from: start.toISOString(), to: end.toISOString() };
}
export function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
