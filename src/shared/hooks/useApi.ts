import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/http';

/** Loads data with loading / error / reload, ignoring responses that arrive after unmount or a newer request. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(deps);

  useEffect(() => {
    let active = true;
    load()
      .then((value) => {
        if (!active) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // The caller lists the inputs of load in deps (serialised into key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);

  const reload = useCallback(() => setRevision((r) => r + 1), []);
  return { data, error, loading: loading && data === undefined, reload, setData };
}

/** Wraps a mutation: blocks double submission, exposes the last error, returns the result or undefined. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async <R,>(action: () => Promise<R>): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, run, setError };
}
