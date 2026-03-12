/**
 * ReaderEngineContext
 *
 * A separate, lightweight context for the two values that change on every RSVP
 * tick: `currentWordIndex` and `isPlaying`. Splitting these out of the main
 * ReaderContext means the large context value object (which contains all the
 * settings and stable callbacks) does NOT create a new object identity 25×/sec
 * at 1500 WPM. Only components that explicitly consume this context (e.g.
 * ReaderViewport, ContextPreview) will re-render on every tick.
 */

import { createContext, useContext } from 'react';

export interface EngineContextValue {
  currentWordIndex: number;
  isPlaying: boolean;
}

export const ReaderEngineContext = createContext<EngineContextValue>({
  currentWordIndex: 0,
  isPlaying: false,
});

/** Hook to consume the engine context. Safe to call outside a provider — returns defaults. */
export function useEngineContext(): EngineContextValue {
  return useContext(ReaderEngineContext);
}
