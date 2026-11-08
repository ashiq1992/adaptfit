import { createContext, useContext } from 'react';
import type { AppData } from '../data/useAppData';
import type { RpgState } from '../domain/rpg';
import type { Profile } from '../domain/types';

export interface AppContextValue {
  data: AppData & { profile: Profile };
  today: string;
  rpg: RpgState;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside the app shell');
  return v;
}
