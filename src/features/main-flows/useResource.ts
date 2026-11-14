import { useEffect, useState } from 'react';
import { errorMessage } from './api';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ source: typeof load; revision: number; data?: T; error?: string; errorCause?: unknown }>();
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ source: load, revision, data });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setState({ source: load, revision, error: errorMessage(error), errorCause: error });
    });
    return () => controller.abort();
  }, [load, revision]);
  // Treat the resource as pending as soon as the loader changes or reload is requested.
  // The previous result may still be in state until the new request finishes.
  const current = state?.source === load && state.revision === revision ? state : undefined;
  return { data: current?.data, error: current?.error, errorCause: current?.errorCause, pending: !current, reload: () => setRevision((value) => value + 1) };
}
