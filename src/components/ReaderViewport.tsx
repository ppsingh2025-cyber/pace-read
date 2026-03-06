/**
 * ReaderViewport
 *
 * v10 — Unified left-aligned layout for both single-word and multi-word modes.
 *
 * Both modes share:
 *   - Same padding-left (16px = --space-4) — word starts at the same X
 *   - Same flex-start direction — no centering
 *   - Zero visual jump when switching windowSize 1 ↔ 2
 *
 * ORP (Optimal Recognition Point):
 *   When orpEnabled OR focalLine is true, the center word is split into three
 *   inline spans [prefix][orp-letter][suffix] in both modes uniformly.
 *   No dedicated grid layout.
 *
 * Focal tick marks:
 *   Ticks are placed at a fixed X computed from font metrics (hidden 'n' span).
 *   The position never changes between words — only recalculates on font size
 *   change or focalLine toggle. This eliminates per-word jitter entirely.
 */

import { memo, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
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
  /** Whether to render ORP (Optimal Recognition Point) on the center word */
  orpEnabled: boolean;
  /** Whether to dim non-center words proportional to their distance from center */
  peripheralFade: boolean;
  isLoading: boolean;
  loadingProgress: number;
  hasWords: boolean;
  /** When true, the viewport expands to fill the available vertical space */
  fullHeight?: boolean;
  /** User-controlled font size scale for the ORP (center) word (percentage, 60–200, default 100) */
  mainWordFontSize?: number;
  /** Called when the user clicks the "Upload File" placeholder button */
  onFileSelect?: (file: File) => void;
  /** Called when the user clicks the "Paste Text" placeholder button */
  onShowPaste?: () => void;
  /** Whether to show the subtle focus marker dot beneath the ORP character */
  focusMarkerEnabled?: boolean;
  /** When true, renders focal guide tick marks above and below the ORP character */
  focalLine?: boolean;
  /** Total number of words loaded — used to gate tick mark visibility */
  words?: string[];
}

/**
 * Calculate the ORP index for a word (0-based character index).
 * Classic algorithm: position ≈ ceil(length / 5) - 1 (≈ 20% from left).
 * Single-character words use index 0.
 */
function calcOrpIndex(word: string): number {
  if (!word) return 0;
  return Math.max(0, Math.ceil(word.length / 5) - 1);
}

/**
 * Compute a CSS font-size value for the ORP (center) word based on the user's
 * mainWordFontSize preference (percentage 60–200, mapped to a scale factor).
 */
function computeOrpFontSize(
  isFullHeight: boolean,
  userScale: number,
): string | undefined {
  if (userScale === 1) return undefined;
  const minFontRem = isFullHeight ? 2 : 1.1;
  const maxFontRem = isFullHeight ? 6 : 3.2;
  const vwCoeff    = isFullHeight ? 10 : 8;
  return [
    `clamp(${(minFontRem * userScale).toFixed(3)}rem,`,
    ` calc(${(vwCoeff * userScale).toFixed(3)}vw),`,
    ` ${(maxFontRem * userScale).toFixed(3)}rem)`,
  ].join('');
}

/**
 * Slot opacity for context words in multi-word mode.
 * Slot 0 (main word) is always full opacity.
 */
function getSlotOpacity(
  slotIndex: number,
  windowSize: number,
  peripheralFade: boolean,
): number {
  if (windowSize === 1) return 1;
  if (slotIndex === 0) return 1;
  if (!peripheralFade) return 0.65;
  if (slotIndex === 1) return 0.55;
  if (slotIndex === 2) return 0.35;
  return 0.2;
}

const ReaderViewport = memo(function ReaderViewport({
  wordWindow,
  highlightIndex,
  highlightColor,
  orientation,
  orpEnabled,
  peripheralFade,
  isLoading,
  loadingProgress,
  hasWords,
  fullHeight,
  mainWordFontSize = 100,
  onFileSelect,
  onShowPaste,
  focalLine = false,
  words = [],
}: ReaderViewportProps) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  /** Outermost viewport div — receives --focal-tick-x CSS variable */
  const viewportRef   = useRef<HTMLDivElement>(null);
  /** Hidden 'n' span — used for font metric measurement only */
  const measureRef    = useRef<HTMLSpanElement>(null);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) onFileSelect(file);
  };

  const userScale   = mainWordFontSize / 100;
  const isMultiWord = wordWindow.length > 1;

  // ORP coloring: focalLine always wins — colors ORP regardless of orpEnabled toggle
  const shouldColorOrp = orpEnabled || focalLine;

  // Ticks appear in horizontal mode only when a document is loaded
  const showFocalTicks =
    focalLine &&
    orientation === 'horizontal' &&
    words.length > 0;

  // Current main word (slot 0 always)
  const currentWord = wordWindow[0] ?? '';
  const orpIdx      = calcOrpIndex(currentWord);

  /**
   * Measure font metrics once to calculate a fixed tick X position.
   * Dependency array: [focalLine, mainWordFontSize] only.
   * currentWordIndex is deliberately EXCLUDED — the tick must never move between words.
   * The fixed X = padding-left (16px) + 0.8 × average character width.
   * This lands near the 2nd character, which is the typical English ORP position.
   */
  useEffect(() => {
    if (!focalLine) return;
    if (!measureRef.current || !viewportRef.current) return;

    const charRect    = measureRef.current.getBoundingClientRect();
    const paddingLeft = 16; // --space-4 = 16px
    const charWidth   = charRect.width;

    // Place tick near the typical ORP position (≈ 2nd character from left)
    const fixedTickX  = paddingLeft + charWidth * 0.8;
    viewportRef.current.style.setProperty('--focal-tick-x', `${fixedTickX}px`);
  }, [focalLine, mainWordFontSize]);

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport}${fullHeight ? ` ${styles.viewportFull}` : ''}`}
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Focal tick marks — absolutely positioned inside the viewport */}
      {showFocalTicks && (
        <>
          <div className={styles.focalTickTop}    aria-hidden="true" />
          <div className={styles.focalTickBottom} aria-hidden="true" />
        </>
      )}

      {/* Hidden measuring span — font metrics for fixed tick position.
          Uses same CSS class as main word for accurate char width. */}
      {focalLine && (
        <span
          ref={measureRef}
          className={styles.mainWord}
          aria-hidden="true"
          style={{
            visibility: 'hidden',
            position: 'absolute',
            pointerEvents: 'none',
            top: 0,
            left: 0,
            whiteSpace: 'nowrap',
          }}
        >
          n
        </span>
      )}

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
        <div className={styles.placeholder}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,.txt,.md,.html,.htm,.rtf,.srt,.docx"
            className={styles.hiddenFileInput}
            onChange={handleFileChange}
            aria-hidden="true"
            tabIndex={-1}
          />
          <p className={styles.helpHeading}>Ready to speed-read?</p>
          <p className={styles.helpBody}>
            <button
              className={styles.helpLink}
              onClick={handleUploadClick}
              aria-label="Upload a file to start reading"
            >
              Upload a file
            </button>
            {' '}(PDF, EPUB, TXT, MD, HTML, RTF, SRT, DOCX){' '}
            or{' '}
            <button
              className={styles.helpLink}
              onClick={() => onShowPaste?.()}
              aria-label="Paste text to start reading"
            >
              paste text
            </button>
            {' '}to get started.
          </p>
        </div>
      ) : orientation === 'vertical' ? (
        /*
         * Vertical layout: words stacked, each centered.
         * Unchanged from original — no tick marks in vertical mode.
         */
        <div
          className={styles.windowVertical}
          style={{ '--slot-count': wordWindow.length } as CSSProperties}
        >
          {wordWindow.map((word, i) => {
            const isCenter  = i === highlightIndex;
            const opacity   = getSlotOpacity(i, wordWindow.length, peripheralFade);
            const scaledFont = isCenter
              ? computeOrpFontSize(fullHeight ?? false, userScale)
              : undefined;
            return (
              <span
                key={i}
                className={`${styles.wordSlot}${isCenter ? ` ${styles.wordSlotCenter}` : ''}`}
                style={{
                  ...(isCenter && !focalLine ? { color: highlightColor } : undefined),
                  ...(opacity < 1 ? { opacity } : undefined),
                  ...(scaledFont ? { fontSize: scaledFont } : undefined),
                }}
                aria-hidden={!word ? true : undefined}
              >
                {word || '\u00A0'}
              </span>
            );
          })}
        </div>
      ) : (
        /*
         * Horizontal layout — unified for single-word and multi-word modes.
         *
         * Both share:
         *   - padding-left: 16px (--space-4) — word starts at same left edge
         *   - justify-content: flex-start — no centering
         *
         * Slot 0 (main word) is rendered identically in both modes:
         *   - When focalLine or orpEnabled: split pre/ORP/post for coloring
         *   - When neither: plain word text
         *
         * Multi-word adds a contextWrapper for slots 1+ at natural content width.
         */
        <div className={isMultiWord ? styles.wordLayoutMulti : styles.wordLayoutSingle}>

          {/* ── Slot 0 — main word (identical in both modes) ─────── */}
          {(() => {
            const scaledFont = computeOrpFontSize(fullHeight ?? false, userScale);
            return (
              <span
                className={`${styles.mainWord}${isMultiWord ? ` ${styles.mainWordInRow}` : ''}`}
                style={scaledFont ? { fontSize: scaledFont } : undefined}
              >
                {shouldColorOrp ? (
                  // Split for ORP coloring — same in single and multi-word mode
                  <>
                    {currentWord.slice(0, orpIdx)}
                    <span style={{ color: highlightColor }}>
                      {currentWord[orpIdx]}
                    </span>
                    {currentWord.slice(orpIdx + 1)}
                  </>
                ) : (
                  currentWord
                )}
              </span>
            );
          })()}

          {/* ── Context words — multi-word only ─────────────────── */}
          {isMultiWord && (
            <div className={styles.contextWrapper}>
              {wordWindow.slice(1).map((word, i) => {
                if (!word) return null; // empty trailing slot — no DOM node

                const actualSlot = i + 1;
                const isLastSlot = actualSlot === wordWindow.length - 1;

                return (
                  <span
                    key={actualSlot}
                    className={
                      isLastSlot
                        ? styles.contextWordLast
                        : styles.contextWord
                    }
                    style={{
                      opacity: getSlotOpacity(
                        actualSlot,
                        wordWindow.length,
                        peripheralFade,
                      ),
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
});

export default ReaderViewport;
