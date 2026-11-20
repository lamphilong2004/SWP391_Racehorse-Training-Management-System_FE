import { lazy, Suspense } from 'react';

const StableMapPage = lazy(() => import('../stable-map/StableMapPage').then((module) => ({ default: module.StableMapPage })));
const BillingPage = lazy(() => import('./BillingPage').then((module) => ({ default: module.BillingPage })));
const OwnerInvoicesPage = lazy(() => import('./OwnerInvoicesPage').then((module) => ({ default: module.OwnerInvoicesPage })));
const VnpayReturnPage = lazy(() => import('./OwnerInvoicesPage').then((module) => ({ default: module.VnpayReturnPage })));

const loading = (text: string) => <p role="status">{text}</p>;

/** DEC-016 route entries, loaded on demand like the other Flow 4 screens. */
export function StableMapEntry() {
  return <Suspense fallback={loading('Đang tải sơ đồ chuồng…')}><StableMapPage /></Suspense>;
}
export function BillingEntry() {
  return <Suspense fallback={loading('Đang tải phí dịch vụ…')}><BillingPage /></Suspense>;
}
export function OwnerInvoicesEntry() {
  return <Suspense fallback={loading('Đang tải hóa đơn…')}><OwnerInvoicesPage /></Suspense>;
}
export function VnpayReturnEntry() {
  return <Suspense fallback={loading('Đang xác nhận thanh toán…')}><VnpayReturnPage /></Suspense>;
}
