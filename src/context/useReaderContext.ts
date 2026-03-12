/**
 * useReaderContext
 *
 * Convenience hook for consuming ReaderContext. Extracted to a separate file
 * so that ReaderContext.tsx can export only the ReaderProvider component,
 * satisfying the react-refresh/only-export-components lint rule.
 *
 * Merges the main ReaderContext (stable settings + callbacks) with
 * ReaderEngineContext (currentWordIndex + isPlaying, ticked 25×/sec) so
 * all existing consumers receive the full combined shape without changes.
 */

import { useContext } from 'react';
import { ReaderContext, type ReaderContextValue } from './readerContextDef';
import { useEngineContext, type EngineContextValue } from './ReaderEngineContext';

export type FullReaderContextValue = ReaderContextValue & EngineContextValue;

export function useReaderContext(): FullReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error('useReaderContext must be used within ReaderProvider');
  return { ...ctx, ...useEngineContext() };
}
