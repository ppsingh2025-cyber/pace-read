/**
 * useAudioMode
 *
 * Integrates the singleton AudioController with the RSVP playback engine.
 *
 * Reading modes:
 *  - 'visual'  → RSVP only. Audio is never started.
 *  - 'guided'  → Audio plays the full remaining text alongside RSVP.
 *                WPM is automatically capped at GUIDED_WPM_CAP so that RSVP
 *                speed stays in the same ballpark as natural speech.
 *  - 'assist'  → Audio plays for ASSIST_DURATION_MS (default 5 s) then stops
 *                automatically. RSVP continues independently at its own speed.
 *
 * Synchronisation strategy (why perfect sync is impossible):
 *   The browser SpeechSynthesis API provides 'start', 'end', and 'boundary'
 *   events. However:
 *   • 'boundary' (word-level) events are inconsistently fired — missing on
 *     many mobile browsers (especially iOS/Safari) and unreliable in timing.
 *   • There is no seek / time-offset API, so restarting from an arbitrary
 *     word position requires re-feeding the whole remaining text.
 *   • Utterance timing depends on the chosen voice and system TTS engine,
 *     both of which vary across platforms.
 *
 *   Best-effort approach implemented here:
 *   • Both audio and RSVP start simultaneously when the user presses play.
 *   • Audio is spoken from words[currentWordIndex] onward (remaining text).
 *   • On pause, audio is stopped (cancel). On resume, audio restarts from the
 *     new currentWordIndex — keeping rough alignment without fake precision.
 *   • If drift accumulates, the visual RSVP display remains stable and correct;
 *     audio may be slightly ahead or behind but does not block visual progress.
 *
 * Edge cases handled:
 *   • Rapid play/pause: stop() is called before every play() (in AudioController).
 *   • Mode switch mid-play: effect re-runs, stops old audio, starts new behaviour.
 *   • Text change while playing: effect re-runs on words change, restarts audio.
 *   • Unmount: cleanup calls audioController.stop().
 *   • No words loaded: audio is not started.
 */

import { useEffect, useRef } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import { audioController, wpmToSpeechRate } from './AudioController';

/** WPM cap for Guided mode — keeps RSVP roughly in sync with natural speech. */
export const GUIDED_WPM_CAP = 250;

/** Duration (ms) that audio plays in Assist mode before stopping automatically. */
export const ASSIST_DURATION_MS = 5_000;

export function useAudioMode(): void {
  const {
    words,
    currentWordIndex,
    isPlaying,
    wpm,
    audioEnabled,
    audioMode,
    setWpm,
  } = useReaderContext();

  /** Timer handle for Assist mode auto-stop */
  const assistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** WPM stored before a Guided-mode cap was applied — used to restore on exit */
  const preCapWpmRef = useRef<number | null>(null);

  // ── Guided mode WPM cap ─────────────────────────────────────────────────────
  // When Guided mode is active and wpm exceeds the cap:
  //   1. Save the original WPM in a ref.
  //   2. Clamp it down to GUIDED_WPM_CAP.
  // When Guided mode is no longer active, restore the saved WPM.
  useEffect(() => {
    const isGuided = audioEnabled && audioMode === 'guided';

    if (isGuided) {
      if (wpm > GUIDED_WPM_CAP) {
        if (preCapWpmRef.current === null) {
          // First cap — remember what WPM the user had
          preCapWpmRef.current = wpm;
        }
        setWpm(GUIDED_WPM_CAP);
      }
    } else {
      // Exiting guided mode — restore saved WPM if we previously capped it
      if (preCapWpmRef.current !== null) {
        setWpm(preCapWpmRef.current);
        preCapWpmRef.current = null;
      }
    }
    // Only track the mode & enabled flag here; wpm changes are handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled, audioMode]);

  // ── Prevent WPM from being raised above the cap while guided mode is on ────
  useEffect(() => {
    if (audioEnabled && audioMode === 'guided' && wpm > GUIDED_WPM_CAP) {
      setWpm(GUIDED_WPM_CAP);
    }
  }, [wpm, audioEnabled, audioMode, setWpm]);

  // ── Main audio lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    // Clear any pending assist timer when any dependency changes
    if (assistTimerRef.current !== null) {
      clearTimeout(assistTimerRef.current);
      assistTimerRef.current = null;
    }

    // Nothing to do in visual mode or when audio is disabled or when not playing
    if (!audioEnabled || audioMode === 'visual' || !isPlaying || words.length === 0) {
      audioController.stop();
      return;
    }

    // Build the remaining text from the current word position onward
    const remainingText = words.slice(currentWordIndex).join(' ');
    if (!remainingText.trim()) {
      audioController.stop();
      return;
    }

    const rate = wpmToSpeechRate(audioMode === 'guided' ? Math.min(wpm, GUIDED_WPM_CAP) : wpm);

    // Start audio
    audioController.play(remainingText, rate);

    // Assist mode: schedule automatic stop after ASSIST_DURATION_MS
    if (audioMode === 'assist') {
      assistTimerRef.current = setTimeout(() => {
        audioController.stop();
        assistTimerRef.current = null;
        // RSVP continues independently — we do NOT pause isPlaying here
      }, ASSIST_DURATION_MS);
    }

    return () => {
      // Cleanup: stop audio when effect re-runs or component unmounts
      if (assistTimerRef.current !== null) {
        clearTimeout(assistTimerRef.current);
        assistTimerRef.current = null;
      }
      audioController.stop();
    };
    // Re-run when play state, text, or mode changes.
    // currentWordIndex is intentionally excluded: we only restart audio on play/pause
    // transitions or text changes, not on every word advance (that would restart audio
    // 5 times per second at 300 WPM — far too disruptive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, audioEnabled, audioMode, words]);
}
