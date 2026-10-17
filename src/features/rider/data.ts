import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { createRiderApi, type RiderApi } from './api';
import type { RiderResult, RiderSession } from './types';
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
export const when = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const value = (number: number | null | undefined, unit: string) => number === null || number === undefined ? 'Not measured' : `${number.toLocaleString()} ${unit}`;
export function useRiderApi(supplied?: RiderApi) {
  const { handleApiError } = useAuth();
  return useMemo(() => supplied ?? createRiderApi({ handleApiError }), [supplied, handleApiError]);
}
export function useRiderSession(id: number, api: RiderApi, poll = false) {
  const { handleApiError } = useAuth();
  const [session, setSession] = useState<RiderSession>();
  const [result, setResult] = useState<RiderResult>();
  const [error, setError] = useState<unknown>();
  const [resultError, setResultError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string>();
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  useEffect(() => {
    let active = true;
    api.session(id).then((data) => {
      if (!active) return;
      if (data.id !== id) throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned a different ride.');
      setSession(data); setSyncedAt(new Date().toISOString()); setError(undefined); setSnapshotVersion((version) => version + 1);
    }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    api.result(id).then((data) => {
      if (!active) return;
      if (data.session.id !== id) throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned a different result.');
      setResult(data); setResultError(undefined);
    }).catch((cause: unknown) => { if (active && !handleApiError(cause)) { setResult(undefined); setResultError(cause); } });
    return () => { active = false; };
  }, [id, api, attempt, handleApiError]);
  useEffect(() => {
    if (!poll) return;
    const timer = setInterval(() => setAttempt((current) => current + 1), 5000);
    return () => clearInterval(timer);
  }, [poll]);
  return { session, result, error, resultError, syncedAt, snapshotVersion, reload: () => setAttempt((current) => current + 1) };
}
