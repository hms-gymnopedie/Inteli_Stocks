/**
 * Global tour state — B25.
 *
 * Lives at the App root so any page can launch a tour by name and the
 * Tour overlay (rendered in App.tsx) reads which steps to walk.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import { TOURS } from './tours';
import type { TourStep } from './Tour';

interface TourState {
  activeTour: { name: string; steps: TourStep[] } | null;
  start: (name: keyof typeof TOURS) => void;
  stop: () => void;
}

const Ctx = createContext<TourState | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourState['activeTour']>(null);

  const start = useCallback((name: keyof typeof TOURS) => {
    const t = TOURS[name];
    if (!t) return;
    setActiveTour({ name: String(name), steps: t.steps });
  }, []);

  const stop = useCallback(() => setActiveTour(null), []);

  return <Ctx.Provider value={{ activeTour, start, stop }}>{children}</Ctx.Provider>;
}

export function useTour(): TourState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used inside <TourProvider>');
  return v;
}
