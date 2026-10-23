import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { createSupportingApi, type SupportingApi } from './supportingApi';
export function useSupportingApi(supplied?: SupportingApi) {
  const { handleApiError } = useAuth();
  return useMemo(() => supplied ?? createSupportingApi({ handleApiError }), [supplied, handleApiError]);
}
export function useSupportingLoad<T>(load: () => Promise<T>, keys: readonly unknown[]) {
  const { handleApiError } = useAuth();
  const [data, setData] = useState<T>(); const [error, setError] = useState<unknown>(); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(load).then((value) => { if (active) { setData(value); setError(undefined); } }).catch((cause: unknown) => { if (active && !handleApiError(cause)) { setData(undefined); setError(cause); } });
    return () => { active = false; };
    // The loader's semantic inputs are explicitly supplied by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...keys, attempt, handleApiError]);
  return { data, error, retry: () => { setData(undefined); setError(undefined); setAttempt((old) => old + 1); } };
}
export const supportingError = (cause: unknown) => cause instanceof Error ? cause.message : 'Không tải được dữ liệu này.';
export function dateRange(date: Date, days = 30) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const to = new Date(from); to.setDate(to.getDate() + days); to.setMilliseconds(-1);
  return { from: from.toISOString(), to: to.toISOString() };
}
