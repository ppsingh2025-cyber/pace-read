/**
 * ReaderViewport
 *
 * Displays the rolling word window in a fixed focal position.
 * The center word is highlighted (bold + configurable color).
 * Orientation can be horizontal or vertical.
 *
 * Performance: only re-renders when window contents change (memo boundary).
 * Layout is fixed-size so no layout shift occurs when words change.
 */

import { memo } from 'react';
import type { Orientation } from '../context/readerContextDef';
import styles from '../styles/ReaderViewport.module.css';

interface ReaderViewportProps {
  /** Ordered list of words in the current window (length = windowSize) */
  wordWindow: string[];
  /** Index within wordWindow that should be highlighted (the center word) */
  highlightIndex: number;
  /** CSS color string for the highlighted word */
  highlightColor: string;
  /** Layout direction for the word window */
  orientation: Orientation;
  isLoading: boolean;
  loadingProgress: number;
  hasWords: boolean;
}

/** Non-breaking space used to keep empty window slots visible without text */
const EMPTY_SLOT_PLACEHOLDER = '\u00A0';

const ReaderViewport = memo(function ReaderViewport({
  wordWindow,
  highlightIndex,
  highlightColor,
  orientation,
  isLoading,
  loadingProgress,
  hasWords,
}: ReaderViewportProps) {
  return (
    <div className={styles.viewport} aria-live="assertive" aria-atomic="true">
      {isLoading ? (
        <div className={styles.loading}>
          <p>Parsing file… {loadingProgress}%</p>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={loadingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      ) : !hasWords ? (
        <p className={styles.placeholder}>
          Upload a file, paste text, or enter a URL to start reading
        </p>
      ) : (
        <div
          className={
            orientation === 'vertical' ? styles.windowVertical : styles.windowHorizontal
          }
        >
          {wordWindow.map((word, i) => (
            <span
              key={i}
              className={styles.wordSlot}
              style={
                i === highlightIndex
                  ? { color: highlightColor, fontWeight: 700 }
                  : undefined
              }
              aria-hidden={word === '' ? true : undefined}
            >
              {word || EMPTY_SLOT_PLACEHOLDER}
            </span>
          ))}
        </div>
      )}
      {/* Fixed focal guide line */}
      <div className={styles.focalLine} aria-hidden="true" />
    </div>
  );
});

export default ReaderViewport;
