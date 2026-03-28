/**
 * AudioControls
 *
 * Compact audio UI row rendered inside the Controls panel.
 *
 * Layout:
 *   [🔊 Audio toggle]  [Visual] [Guided] [Assist]   ← mode pills, shown only when audio is on
 *
 * Design principles:
 * - Audio logic lives entirely in useAudioMode (App.tsx) and AudioController.
 *   This component only reads/writes context state — no direct TTS calls.
 * - Minimal footprint: one row, consistent with the existing Controls design language.
 * - Guided mode shows a WPM cap badge so users understand the speed restriction.
 */

import { memo, useCallback } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import type { AudioMode } from '../audio/AudioController';
import { GUIDED_WPM_CAP } from '../audio/useAudioMode';
import styles from '../styles/AudioControls.module.css';

const MODE_LABELS: Record<AudioMode, string> = {
  visual: 'Visual',
  guided: 'Guided',
  assist: 'Assist',
};

const MODE_TITLES: Record<AudioMode, string> = {
  visual: 'RSVP only — no audio',
  guided: `Audio + RSVP together (WPM capped at ${GUIDED_WPM_CAP})`,
  assist: 'Audio plays briefly then stops; RSVP continues',
};

const AUDIO_MODES: AudioMode[] = ['visual', 'guided', 'assist'];

export default memo(function AudioControls() {
  const { audioEnabled, audioMode, setAudioEnabled, setAudioMode, wpm } = useReaderContext();

  const handleToggle = useCallback(() => {
    setAudioEnabled(!audioEnabled);
  }, [audioEnabled, setAudioEnabled]);

  const handleModeSelect = useCallback((mode: AudioMode) => {
    setAudioMode(mode);
    // Ensure audio is enabled when the user picks a mode
    if (!audioEnabled) setAudioEnabled(true);
  }, [audioEnabled, setAudioEnabled, setAudioMode]);

  const isGuidedCapped = audioEnabled && audioMode === 'guided' && wpm >= GUIDED_WPM_CAP;

  return (
    <div className={styles.audioRow}>
      {/* Toggle button */}
      <button
        type="button"
        className={`${styles.audioToggle}${audioEnabled ? ` ${styles.audioToggleOn}` : ''}`}
        onClick={handleToggle}
        title={audioEnabled ? 'Disable audio' : 'Enable audio (Text-to-Speech)'}
        aria-label={audioEnabled ? 'Audio on — tap to disable' : 'Audio off — tap to enable'}
        aria-pressed={audioEnabled}
      >
        {audioEnabled ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        )}
        <span className={styles.audioToggleLabel}>Audio</span>
      </button>

      {/* Mode pills — always visible so users can select a mode before toggling on */}
      <div className={styles.modePills} role="group" aria-label="Audio mode">
        {AUDIO_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`${styles.modePill}${
              audioEnabled && audioMode === mode ? ` ${styles.modePillActive}` : ''
            }${!audioEnabled ? ` ${styles.modePillDisabled}` : ''}`}
            onClick={() => handleModeSelect(mode)}
            title={MODE_TITLES[mode]}
            aria-label={`${MODE_LABELS[mode]} audio mode`}
            aria-pressed={audioEnabled && audioMode === mode}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Cap indicator — shown only in guided mode when WPM is at the limit */}
      {isGuidedCapped && (
        <span
          className={styles.capBadge}
          title={`Speed capped at ${GUIDED_WPM_CAP} WPM in Guided mode`}
          aria-label={`Speed capped at ${GUIDED_WPM_CAP} WPM`}
        >
          {GUIDED_WPM_CAP} max
        </span>
      )}
    </div>
  );
});
