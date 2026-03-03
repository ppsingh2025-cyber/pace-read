/**
 * useRSVPEngine
 *
 * Core hook that drives the rolling-window word display.
 *
 * Architecture decisions:
 * - Uses setInterval with drift correction so high WPM rates don't accumulate
 *   timing errors. The interval is restarted whenever WPM changes so the new
 *   speed takes effect immediately without resetting position.
 * - Current word index is mirrored in a ref inside the engine so the interval
 *   callback can read/write it without stale-closure issues.
 * - currentWordIndex always points to the CENTER (highlight) word of the window.
 *   The window advances by ONE word per tick regardless of window size, keeping
 *   WPM accuracy independent of window size.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReaderContext } from '../context/useReaderContext';

export function useRSVPEngine() {
  const {
    words,
    currentWordIndex,
    isPlaying,
    wpm,
    windowSize,
    setCurrentWordIndex,
    setIsPlaying,
    resetReader,
    setWpm,
  } = useReaderContext();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirror of currentWordIndex accessible inside interval callback without stale closure
  const indexRef = useRef<number>(currentWordIndex);
  const wordsLenRef = useRef<number>(words.length);
  // Track the expected time of the next tick for drift correction
  const nextTickRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => {
    indexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  useEffect(() => {
    wordsLenRef.current = words.length;
  }, [words.length]);

  const clearEngine = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startEngine = useCallback(
    (intervalMs: number) => {
      clearEngine();
      nextTickRef.current = performance.now() + intervalMs;

      intervalRef.current = setInterval(() => {
        const now = performance.now();
        // Drift correction: adjust next expected tick based on how late we fired
        const drift = now - nextTickRef.current;
        nextTickRef.current = now + intervalMs - drift;

        const nextIndex = indexRef.current + 1;
        if (nextIndex >= wordsLenRef.current) {
          // Reached end – stop playback
          clearEngine();
          setIsPlaying(false);
          return;
        }
        indexRef.current = nextIndex;
        setCurrentWordIndex(nextIndex);
      }, intervalMs);
    },
    [clearEngine, setCurrentWordIndex, setIsPlaying],
  );

  // (Re)start engine whenever play state, speed, or word list changes
  useEffect(() => {
    if (isPlaying && words.length > 0) {
      const intervalMs = 60_000 / wpm;
      startEngine(intervalMs);
    } else {
      clearEngine();
    }
    return clearEngine;
  }, [isPlaying, wpm, words.length, startEngine, clearEngine]);

  const play = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const reset = useCallback(() => resetReader(), [resetReader]);

  const faster = useCallback(() => {
    setWpm(Math.min(1000, Math.round(wpm * 1.2)));
  }, [setWpm, wpm]);

  const slower = useCallback(() => {
    setWpm(Math.max(60, Math.round(wpm / 1.2)));
  }, [setWpm, wpm]);

  const prevWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex(Math.max(0, currentWordIndex - 1));
  }, [setIsPlaying, setCurrentWordIndex, currentWordIndex]);

  const nextWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 1));
  }, [setIsPlaying, setCurrentWordIndex, currentWordIndex, words.length]);

  /**
   * Build the rolling word window centered on currentWordIndex.
   * The array always has `windowSize` slots; slots beyond word boundaries
   * are empty strings so the middle word stays in a fixed focal position.
   *
   * Window size timing: the engine always advances ONE word per tick, so WPM
   * accuracy is completely independent of window size — the window is purely
   * a rendering concern.
   */
  const wordWindow = useMemo<string[]>(() => {
    const half = Math.floor(windowSize / 2);
    return Array.from({ length: windowSize }, (_, slot) => {
      const wordIdx = currentWordIndex - half + slot;
      if (wordIdx < 0 || wordIdx >= words.length) return '';
      return words[wordIdx];
    });
  }, [words, currentWordIndex, windowSize]);

  // The center word is the traditional "current word" for backward compat
  const currentWord = words[currentWordIndex] ?? '';

  return { currentWord, wordWindow, play, pause, reset, faster, slower, prevWord, nextWord };
}
