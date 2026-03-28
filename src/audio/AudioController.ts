/**
 * AudioController
 *
 * Platform-aware abstraction layer for Text-to-Speech playback.
 *
 * Two concrete implementations are provided behind a single IAudioController interface:
 *
 *   CapacitorAudioController (iOS + Android native builds)
 *   ─────────────────────────────────────────────────────
 *   Uses @capacitor-community/text-to-speech which routes to:
 *     • iOS  — AVSpeechSynthesizer  (bypasses all WKWebView limitations)
 *     • Android — android.speech.tts.TextToSpeech  (bypasses WebView TTS unreliability)
 *   Benefits over window.speechSynthesis on mobile:
 *     • No 15-second utterance truncation on iOS
 *     • Works correctly when the screen locks (category: 'playback')
 *     • pause() works reliably (native layer)
 *     • Does not require a synchronous user-gesture token (native bridge is exempt)
 *     • QueueStrategy.Flush cancels any in-progress speech automatically on play()
 *
 *   BrowserAudioController (web / PWA)
 *   ────────────────────────────────────
 *   Uses window.speechSynthesis for the browser build.
 *   On desktop Chrome/Firefox this is reliable; on mobile web it has limitations
 *   (especially iOS Safari) but is acceptable because the Capacitor path handles all
 *   real mobile deployments.
 *
 * Platform selection
 * ──────────────────
 * createAudioController() is called once at module load time:
 *   Capacitor.isNativePlatform() === true  → CapacitorAudioController
 *   otherwise                              → BrowserAudioController
 *
 * Upgrade path to backend TTS
 * ────────────────────────────
 * Implement IAudioController against an <audio> element or fetch-streaming endpoint,
 * then swap the singleton export — zero changes needed in RSVP or UI code.
 */

import { Capacitor } from '@capacitor/core';
import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Audio modes available in the reading app */
export type AudioMode = 'visual' | 'guided' | 'assist';

/**
 * Public interface — all consumers depend only on this, not on concrete classes.
 * Implement this to swap the audio backend.
 */
export interface IAudioController {
  /**
   * Start speaking `text`.
   * Any in-progress speech is cancelled first to prevent stacking/zombie audio.
   * @param rate  Optional speech rate override (1.0 ≈ 200 WPM, clamped to valid range).
   */
  play(text: string, rate?: number): void;

  /**
   * Pause in-progress speech.
   * On native (Capacitor) this stops the utterance; resume() restarts from position 0
   * because the native TTS API does not support mid-sentence seek.
   * On web this uses speechSynthesis.pause().
   */
  pause(): void;

  /** Resume previously paused speech (web only; no-op on native). */
  resume(): void;

  /** Immediately cancel all speech. */
  stop(): void;

  /**
   * Update the speech rate.
   * Takes effect on the next play() call (live update not supported by any TTS engine).
   */
  setRate(rate: number): void;

  /** True while speech is actively playing or pending. */
  isActive(): boolean;

  /** Called when the current utterance finishes naturally (not on stop()). */
  onEnd: (() => void) | null;

  /** Called when a non-interruption error occurs. */
  onError: ((error: string) => void) | null;
}

// ─── Shared constants ────────────────────────────────────────────────────────

/** Browser SpeechSynthesis rate 1.0 ≈ 200 WPM for a typical English voice. */
const WPM_TO_RATE_FACTOR = 200;

/** Upper bound — stays intelligible across browsers and voices. */
const MAX_SPEECH_RATE = 3.0;

/** Lower bound — prevents silent/broken utterances. */
const MIN_SPEECH_RATE = 0.1;

function clampRate(rate: number): number {
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
}

// ─── CapacitorAudioController (iOS + Android) ────────────────────────────────

/**
 * Uses @capacitor-community/text-to-speech for native iOS/Android builds.
 *
 * Key design choices:
 * - QueueStrategy.Flush: any call to speak() automatically cancels the previous one.
 *   We do NOT need to call stop() first — this prevents a race condition where the
 *   stop() Promise resolves after the new speak() has already started.
 * - category 'playback' (iOS): lets audio continue when the device is in silent mode
 *   and when the screen locks — correct behaviour for a reading-assist feature.
 * - _speaking flag: tracks active state since the native bridge is async.
 * - Promise errors containing 'interrupt'/'cancel' are silently ignored —
 *   they are the normal result of calling stop() while speak() is in flight.
 */
class CapacitorAudioController implements IAudioController {
  private _rate = 1.0;
  private _speaking = false;

  onEnd: (() => void) | null = null;
  onError: ((error: string) => void) | null = null;

  play(text: string, rate?: number): void {
    if (!text.trim()) {
      this.stop();
      return;
    }
    if (rate !== undefined) {
      this._rate = clampRate(rate);
    }
    this._speaking = true;

    // Use the device's preferred language for the best native voice match.
    // Falls back to 'en-US' if the locale cannot be determined.
    const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

    TextToSpeech.speak({
      text,
      rate: this._rate,
      lang,
      // 'playback' lets audio continue even in iOS silent mode and when screen locks.
      category: 'playback',
      // Flush cancels any in-progress utterance before starting the new one.
      queueStrategy: QueueStrategy.Flush,
    })
      .then(() => {
        // Promise resolves when the utterance ends naturally.
        this._speaking = false;
        this.onEnd?.();
      })
      .catch((err: unknown) => {
        this._speaking = false;
        const msg = err instanceof Error ? err.message : String(err);
        // Ignore expected interruption errors (result of stop() being called mid-speech).
        if (!msg.toLowerCase().includes('interrupt') && !msg.toLowerCase().includes('cancel')) {
          this.onError?.(msg);
        }
      });
  }

  pause(): void {
    // The native plugin has no seek-safe pause — stop() is the closest equivalent.
    // useAudioMode does not call pause() directly, so this is a safety net only.
    this.stop();
  }

  resume(): void {
    // After a native stop(), position is lost; cannot resume mid-sentence.
    // useAudioMode handles resume by calling play() with the current word position.
  }

  stop(): void {
    this._speaking = false;
    // Fire-and-forget — errors here don't matter (already stopping).
    TextToSpeech.stop().catch(() => undefined);
  }

  setRate(rate: number): void {
    this._rate = clampRate(rate);
  }

  isActive(): boolean {
    return this._speaking;
  }
}

// ─── BrowserAudioController (web / PWA) ──────────────────────────────────────

/**
 * Uses window.speechSynthesis for the browser / PWA build.
 *
 * Limitations on mobile web (acknowledged):
 * - iOS Safari WKWebView: utterances may be truncated; pause() is unreliable.
 *   This path is only taken on the web build — the Capacitor path handles iOS/Android.
 * - 'interrupted'/'canceled' utterance errors are swallowed (expected on stop()).
 */
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

    // Cancel first — prevents utterance stacking.
    synth.cancel();

    if (!text.trim()) return;

    if (rate !== undefined) {
      this._rate = clampRate(rate);
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = this._rate;

    utt.onend = () => { this.onEnd?.(); };

    utt.onerror = (e: SpeechSynthesisErrorEvent) => {
      // 'interrupted' and 'canceled' are expected results of stop() — not real errors.
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
    this._rate = clampRate(rate);
  }

  isActive(): boolean {
    const synth = this.getSynth();
    if (!synth) return false;
    return synth.speaking || synth.pending;
  }
}

// ─── Factory & singleton ─────────────────────────────────────────────────────

/**
 * Returns the appropriate audio controller for the current platform.
 * Called once at module load time.
 */
function createAudioController(): IAudioController {
  // Capacitor.isNativePlatform() returns true only when running as a compiled
  // iOS/Android app — never on the web build.
  if (Capacitor.isNativePlatform()) {
    return new CapacitorAudioController();
  }
  return new BrowserAudioController();
}

/**
 * Singleton audio controller.
 * Import this from hooks and components — never instantiate directly.
 * To swap the backend, replace this export with a different IAudioController.
 */
export const audioController: IAudioController = createAudioController();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** All valid AudioMode values — use for runtime validation of persisted strings. */
const VALID_AUDIO_MODES: readonly AudioMode[] = ['visual', 'guided', 'assist'];

/** Type guard: checks that `value` is a valid AudioMode string. */
export function isValidAudioMode(value: string): value is AudioMode {
  return (VALID_AUDIO_MODES as readonly string[]).includes(value);
}

/**
 * Convert WPM to a speech rate value (best-effort approximation).
 * 200 WPM → rate 1.0, 400 WPM → rate 2.0, etc.
 */
export function wpmToSpeechRate(wpm: number): number {
  return clampRate(wpm / WPM_TO_RATE_FACTOR);
}
