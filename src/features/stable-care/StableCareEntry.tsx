import { lazy, Suspense } from 'react';
const StableCarePage = lazy(() => import('./StableCarePage').then(module => ({ default: module.StableCarePage })));
export function StableCareEntry() {
  return <Suspense fallback={<p role="status">Đang tải chăm sóc chuồng…</p>}><StableCarePage /></Suspense>;
}
