import { createContext, useContext, type ReactNode } from 'react';
import { businessDataMode, getBusinessActor } from '../../../shared/data/businessData';
import { readSamples, saveSamples } from '../../../shared/data/sampleStore';
import { createHorseHistoryApi } from './historyApi';
import { createHorseHistorySample } from './historySample';
import type { HorseHistoryService } from './historyTypes';

const api = createHorseHistoryApi();
const sample = createHorseHistorySample({ readSamples, saveSamples, getBusinessActor });
const Context = createContext<HorseHistoryService | null>(null);
/** Central feature adapter boundary, injectable for fixtures; no shared router/transport edits. */
export function HorseHistoryProvider({ service, children }: { service: HorseHistoryService; children: ReactNode }) { return <Context.Provider value={service}>{children}</Context.Provider>; }
// eslint-disable-next-line react-refresh/only-export-components
export function useHorseHistoryService() { return useContext(Context) ?? (businessDataMode() === 'sample' ? sample : api); }
