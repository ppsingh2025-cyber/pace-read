/**
 * Controls
 *
 * Three-row playback panel:
 *   Row 1 – Action buttons: Upload · Paste · Back · Play/Pause · Next
 *   Row 2 – WPM pill stepper: [−] 300 WPM [+]
 *   Row 3 – Reset to beginning (low-key text button, opens modal)
 *
 * All interactive elements meet the 44 px minimum touch-target size.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import styles from '../styles/Controls.module.css';

interface ControlsProps {
  onFileSelect: (file: File) => void;
  onPlay: () => void;
  onPause: () => void;
  onResetRequest: () => void;
  onFaster: () => void;
  onSlower: () => void;
  onPrevWord: () => void;
  onNextWord: () => void;
  /** Toggle the paste input panel above the bottom bar */
  onPasteToggle: () => void;
  /** Whether the paste panel is currently open */
  pasteOpen: boolean;
  /** When true (maximize/focus mode) upload and paste buttons are hidden */
  focused?: boolean;
  /** When true, the "previous word" button is disabled */
  prevDisabled?: boolean;
  /** When true, the "next word" button is disabled */
  nextDisabled?: boolean;
}

/** Duration in ms for the WPM flash animation — matches the CSS @keyframes wpmFlash */
const WPM_FLASH_DURATION = 200;
/** Delay before focusing the word-jump input — ensures the element is rendered in the DOM */
const JUMP_FOCUS_DELAY_MS = 50;

export default memo(function Controls({
  onFileSelect,
  onPlay,
  onPause,
  onResetRequest,
  onFaster,
  onSlower,
  onPrevWord,
  onNextWord,
  onPasteToggle,
  pasteOpen,
  focused,
  prevDisabled,
  nextDisabled,
}: ControlsProps) {
  const { isPlaying, wpm, setWpm, words, isLoading, currentWordIndex, goToWord } =
    useReaderContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── WPM inline edit ─────────────────────────────────────────── */
  const [wpmEditing, setWpmEditing] = useState(false);
  const [wpmDraft,   setWpmDraft]   = useState('');
  const wpmInputRef = useRef<HTMLInputElement>(null);

  /* ── WPM flash on speed change ───────────────────────────────── */
  const [wpmFlash, setWpmFlash] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setWpmFlash(true), 0);
    const t2 = setTimeout(() => setWpmFlash(false), WPM_FLASH_DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [wpm]);

  /* ── File upload ─────────────────────────────────────────────── */
  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
        e.target.value = '';
      }
    },
    [onFileSelect],
  );

  const hasWords = words.length > 0;

  /* ── Word jump inline input ─────────────────── */
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDraft, setJumpDraft] = useState('');
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const pct = words.length > 0
    ? Math.round((currentWordIndex / Math.max(words.length - 1, 1)) * 100)
    : 0;

  const handleJumpCommit = useCallback(() => {
    const raw = jumpDraft.trim();
    if (!raw) { setJumpOpen(false); return; }
    if (raw.endsWith('%')) {
      const p = parseFloat(raw);
      if (!isNaN(p)) {
        const idx = Math.round((Math.min(100, Math.max(0, p)) / 100) * (words.length - 1));
        goToWord(idx);
      }
    } else {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) goToWord(Math.min(words.length - 1, Math.max(0, n - 1)));
    }
    setJumpOpen(false);
  }, [jumpDraft, words.length, goToWord]);

  useEffect(() => {
    if (jumpOpen) {
      setJumpDraft('');
      setTimeout(() => jumpInputRef.current?.focus(), JUMP_FOCUS_DELAY_MS);
    }
  }, [jumpOpen]);

  return (
    <div className={styles.controls}>
      <div className={styles.inner}>

        {/* ── Layer 1: Session strip ── */}
        <div className={styles.sessionStrip}>
          {jumpOpen ? (
            <div className={styles.wordJumpStrip}>
              <input
                ref={jumpInputRef}
                type="text"
                inputMode="numeric"
                className={styles.wordJumpInput}
                value={jumpDraft}
                placeholder={`word # or %  (1–${words.length})`}
                onChange={e => setJumpDraft(e.target.value)}
                onBlur={handleJumpCommit}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setJumpOpen(false);
                }}
                aria-label="Jump to word number or percentage"
              />
              <span className={styles.wordJumpHint}>Enter word # or %</span>
            </div>
          ) : (
            <button
              type="button"
              className={styles.sessionInfo}
              onClick={() => hasWords && setJumpOpen(true)}
              disabled={!hasWords}
              title="Tap to jump to any word"
              aria-label={`${pct}% read, word ${currentWordIndex + 1} of ${words.length}. Tap to jump.`}
            >
              <span className={styles.sessionPct}>{hasWords ? `${pct}%` : '—'}</span>
              <span className={styles.sessionPos}>
                {hasWords ? `Word ${currentWordIndex + 1} of ${words.length.toLocaleString()}` : 'No content loaded'}
              </span>
            </button>
          )}

          <button
            type="button"
            className={styles.resetIconBtn}
            onClick={onResetRequest}
            disabled={!hasWords}
            title="Reset to beginning"
            aria-label="Reset to beginning"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                 strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <polyline points="3 3 3 8 8 8"/>
            </svg>
          </button>
        </div>

        {/* ── Layer 2: Action row ── */}
        <div className={styles.actionRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,.txt,.md,.html,.htm,.rtf,.srt,.docx"
            className={styles.hiddenInput}
            onChange={handleFileChange}
            aria-label="Upload file"
          />

          {/* Left cluster: Upload + Paste */}
          <div className={styles.btnCluster}>
            {!focused && (
              <button type="button" className={styles.controlBtn}
                onClick={handleFileClick} disabled={isLoading}
                title="Upload file" aria-label="Upload file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15V3m0 0l-4 4m4-4l4 4"/>
                  <path d="M2 17v2a2 2 0 002 2h16a2 2 0 002-2v-2"/>
                </svg>
                <span className={styles.controlBtnLabel}>Upload</span>
              </button>
            )}
            {!focused && (
              <button type="button"
                className={`${styles.controlBtn}${pasteOpen ? ` ${styles.controlBtnActive}` : ''}`}
                onClick={onPasteToggle} title="Paste text"
                aria-label="Toggle paste panel" aria-pressed={pasteOpen}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="4" rx="1"/>
                  <path d="M9 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2h-2"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="13" y2="16"/>
                </svg>
                <span className={styles.controlBtnLabel}>Paste</span>
              </button>
            )}
          </div>

          {/* Center: Hero play button */}
          <button type="button" className={styles.playBtn}
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasWords}
            title="Play / Pause (Space)"
            aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" fill="currentColor" rx="1"/>
                <rect x="14" y="4" width="4" height="16" fill="currentColor" rx="1"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" fill="currentColor"/>
              </svg>
            )}
          </button>

          {/* Right cluster: Back + Next */}
          <div className={styles.btnCluster}>
            <button type="button" className={styles.controlBtn}
              onClick={onPrevWord} disabled={prevDisabled ?? !hasWords}
              title="Previous word (←)" aria-label="Previous word">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 6 9 12 15 18"/>
              </svg>
              <span className={styles.controlBtnLabel}>Back</span>
            </button>
            <button type="button" className={styles.controlBtn}
              onClick={onNextWord} disabled={nextDisabled ?? !hasWords}
              title="Next word (→)" aria-label="Next word">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18"/>
              </svg>
              <span className={styles.controlBtnLabel}>Next</span>
            </button>
          </div>
        </div>

        {/* ── Layer 3: WPM stepper ── */}
        <div className={styles.wpmRow}>
          <div className={styles.wpmPill}>
            <button type="button" className={styles.wpmPillBtn}
              onClick={onSlower} disabled={isLoading}
              aria-label="Decrease speed" title="Slower (↓)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            {wpmEditing ? (
              <input ref={wpmInputRef} type="number"
                className={styles.wpmPillInput}
                value={wpmDraft} min={60} max={1500}
                onChange={e => setWpmDraft(e.target.value)}
                onBlur={() => {
                  const v = parseInt(wpmDraft, 10);
                  if (!isNaN(v)) setWpm(Math.min(1500, Math.max(60, v)));
                  setWpmEditing(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setWpmEditing(false);
                }}
                autoFocus aria-label="Words per minute"
              />
            ) : (
              <button type="button"
                className={`${styles.wpmPillValue}${wpmFlash ? ` ${styles.wpmPillFlash}` : ''}`}
                onClick={() => { setWpmDraft(String(wpm)); setWpmEditing(true); }}
                aria-label={`${wpm} words per minute, tap to edit`}
                title="Tap to set exact WPM">
                {wpm} <span className={styles.wpmUnit}>WPM</span>
              </button>
            )}

            <button type="button" className={styles.wpmPillBtn}
              onClick={onFaster} disabled={isLoading}
              aria-label="Increase speed" title="Faster (↑)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
})
