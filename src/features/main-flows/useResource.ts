import { useEffect, useState } from 'react';
import { errorMessage } from './api';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ source: typeof load; revision: number; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ source: load, revision, data });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setState({ source: load, revision, error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [load, revision]);
  const current = state?.source === load && state.revision === revision ? state : undefined;
  return { data: current?.data, error: current?.error, pending: !current, reload: () => setRevision((value) => value + 1) };
}
