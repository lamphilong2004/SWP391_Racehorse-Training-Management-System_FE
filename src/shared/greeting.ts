/** Local-time greeting for workspace headers. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}
