import { createContext, useContext, type ReactNode } from 'react';
import type { HorsesApi } from './horsesApi';

const HorsesApiContext = createContext<HorsesApi | null>(null);

/** Supplies the shared authenticated HTTP adapter to CORE-013; tests may inject a fixture adapter. */
export function HorsesApiProvider({ api, children }: { api: HorsesApi; children: ReactNode }) {
  return <HorsesApiContext.Provider value={api}>{children}</HorsesApiContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHorsesApi(): HorsesApi {
  const api = useContext(HorsesApiContext);
  if (!api) throw new Error('useHorsesApi must be used inside <HorsesApiProvider>.');
  return api;
}
