/**
 * AudioController
 *
 * Abstraction layer for Text-to-Speech playback.
 *
 * Uses the browser-native SpeechSynthesis API internally but exposes a
 * backend-agnostic interface (play / pause / resume / stop / setRate) so the
 * engine can be swapped for a backend-driven provider without touching RSVP
 * logic or any UI component.
 *
 * Design decisions:
 * - Singleton: only ONE utterance is ever active at a time.
 *   Calling play() cancels any in-progress speech before starting a new one —
 *   this guarantees no overlap or zombie audio.
 * - Rate mapping: browser SpeechSynthesis rate 1.0 ≈ 200 WPM, so:
 *     speechRate = clamp(wpm / WPM_TO_RATE_FACTOR, MIN_RATE, MAX_RATE)
 * - 'interrupted' / 'canceled' utterance errors are silently swallowed
 *   (they are the expected result of calling stop() mid-speech).
 *
 * Upgrade path to backend TTS:
 *   Implement IAudioController against an <audio> element or Web Audio node,
 *   then swap the singleton export — zero changes needed in RSVP or UI code.
 */

/** Audio modes available in the reading app */
export type AudioMode = 'visual' | 'guided' | 'assist';

/**
 * Public interface — implement this to swap the audio backend.
 * All consumers depend only on this interface, not on the concrete class.
 */
export interface IAudioController {
  /**
   * Start speaking `text`.
   * Cancels any in-progress speech first to prevent stacking.
   * @param rate  Optional speech rate override (1.0 ≈ 200 WPM).
   */
  play(text: string, rate?: number): void;

  /** Pause in-progress speech. No-op when not speaking. */
  pause(): void;

  /** Resume previously paused speech. No-op when not paused. */
  resume(): void;

  /** Immediately cancel all speech and discard the current utterance. */
  stop(): void;

  /**
   * Update the speech rate.
   * Takes effect on the next play() call.
   * @param rate  Clamped to [MIN_SPEECH_RATE, MAX_SPEECH_RATE].
   */
  setRate(rate: number): void;

  /** True while speech is actively playing or queued. */
  isActive(): boolean;

  /** Called when the current utterance finishes naturally (not on stop()). */
  onEnd: (() => void) | null;

  /** Called when a non-interruption error occurs. */
  onError: ((error: string) => void) | null;
}

/** Browser TTS rate 1.0 is roughly 200 WPM for a typical English voice. */
const WPM_TO_RATE_FACTOR = 200;

/** Upper bound to stay intelligible across all browsers and voices. */
const MAX_SPEECH_RATE = 3.0;

/** Lower bound to prevent silent/broken speech. */
const MIN_SPEECH_RATE = 0.1;

class BrowserAudioController implements IAudioController {
  private synth: SpeechSynthesis | null = null;
  private _rate = 1.0;

  onEnd: (() => void) | null = null;
  onError: ((error: string) => void) | null = null;

  private getSynth(): SpeechSynthesis | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    if (!this.synth) this.synth = window.speechSynthesis;
    return this.synth;
  }

  play(text: string, rate?: number): void {
    const synth = this.getSynth();
    if (!synth) return;

    // Always cancel first — prevents stacking utterances
    synth.cancel();

    if (!text.trim()) return;

    if (rate !== undefined) {
      this._rate = Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = this._rate;

    utt.onend = () => {
      this.onEnd?.();
    };

    utt.onerror = (e: SpeechSynthesisErrorEvent) => {
      // 'interrupted' and 'canceled' are the expected result of stop() — not errors
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        this.onError?.(e.error);
      }
    };

    synth.speak(utt);
  }

  pause(): void {
    this.getSynth()?.pause();
  }

  resume(): void {
    this.getSynth()?.resume();
  }

  stop(): void {
    this.getSynth()?.cancel();
  }

  setRate(rate: number): void {
    this._rate = Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
    // Live update is not possible on an existing utterance in the SpeechSynthesis API;
    // the new rate takes effect on the next play() call.
  }

  isActive(): boolean {
    const synth = this.getSynth();
    if (!synth) return false;
    return synth.speaking || synth.pending;
  }
}

/**
 * Singleton audio controller instance.
 * Import and use this directly from hooks and components.
 * To swap the backend, replace this export with a different IAudioController implementation.
 */
export const audioController: IAudioController = new BrowserAudioController();

/**
 * Convert WPM to a SpeechSynthesis speech rate (best-effort approximation).
 * 200 WPM → rate 1.0, 400 WPM → rate 2.0, etc.
 */
export function wpmToSpeechRate(wpm: number): number {
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, wpm / WPM_TO_RATE_FACTOR));
}
