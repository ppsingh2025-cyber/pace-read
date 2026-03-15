/**
 * OnboardingOverlay v6 — 3-step flow: Demo + Calibration / Mode / Load content.
 *
 * Step flow (0-indexed):
 *   0 — 3-phase speed-ramp demo (200→275→350 WPM), ORP annotation, post-demo calibration
 *   1 — Pick reading mode (3 vertical tiles, unchanged from v5)
 *   2 — Load something now (4 action cards)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../styles/OnboardingOverlay.module.css';
import type { Theme } from '../context/readerContextDef';
import type { PresetModeId } from '../types/readingModes';
import { useReaderContext } from '../context/useReaderContext';

const DEMO_WORDS = [
  // Phase 1 — 200 WPM (indices 0–19)
  'Most','reading','is','slow','not','because','your','brain','is','slow',
  'but','because','your','eyes','are','chasing','words','across','a','page',
  // Phase 2 — 275 WPM (indices 20–39)
  'RSVP','removes','that','chase','entirely','Each','word','arrives','at',
  'one','fixed','point','Your','brain','receives','it','without','effort','No',
  // Phase 3 — 350 WPM (indices 40–end)
  'scanning','No','eye','movement','Just','reading','This','is','RSVP','This','is','fast',
];

const DEMO_SEGMENTS: { start: number; end: number; wpm: number }[] = [
  { start: 0,  end: 19, wpm: 200 },
  { start: 20, end: 39, wpm: 275 },
  { start: 40, end: DEMO_WORDS.length - 1, wpm: 350 },
];

// Word index where the demo pauses briefly to show the ORP annotation.
// Index 17 = "across" — ORP char is "a" (index 0), clearly visible.
const ORP_ANNOTATION_INDEX = 17;
const ORP_ANNOTATION_EXTRA_MS = 700; // added to normal interval at this word

function getSegmentWpm(idx: number): number {
  return (DEMO_SEGMENTS.find(s => idx >= s.start && idx <= s.end) ?? DEMO_SEGMENTS[2]).wpm;
}

function getDemoIntervalMs(idx: number): number {
  return Math.round(60_000 / getSegmentWpm(idx));
}

function calcOrpIndex(word: string): number {
  if (!word) return 0;
  return Math.max(0, Math.ceil(word.length / 5) - 1);
}

const MODES = [
  { id: 'speed' as PresetModeId, label: 'Sprint', emoji: '⚡', wpm: '400–500 WPM', desc: 'One word, no pauses. Pure velocity.',                        accent: '#f59e0b' },
  { id: 'focus' as PresetModeId, label: 'Focus',  emoji: '🎯', wpm: '200–300 WPM', desc: 'Colored letter locks your eye. One word at a time.',          accent: 'var(--color-accent)', recommended: true },
  { id: 'read'  as PresetModeId, label: 'Flow',   emoji: '🌊', wpm: '150–200 WPM', desc: 'Up to 5 words with natural rhythm and context.',              accent: '#34d399' },
];

const DEFAULT_ONBOARDING_THEME: Theme = 'obsidian';
const DEFAULT_ONBOARDING_MODE: PresetModeId = 'focus';

interface OnboardingOverlayProps {
  onComplete: (prefs: {
    theme: Theme;
    modeId: PresetModeId;
    wpm?: number;
    action?: 'paste' | 'file' | 'story' | null;
  }) => void;
  onFileSelect: (file: File) => void;
  initialTheme?: Theme;
  initialModeId?: PresetModeId;
}

export default function OnboardingOverlay({ onComplete, onFileSelect, initialTheme, initialModeId }: OnboardingOverlayProps) {
  const { selectPresetMode } = useReaderContext();
  // NOTE: setTheme is NOT destructured — theme is no longer picked in this component

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoFinished, setDemoFinished] = useState(false);
  const [currentDemoWpm, setCurrentDemoWpm] = useState(200);
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [calibratedWpm, setCalibratedWpm] = useState<number | null>(null);
  const [selectedCalibration, setSelectedCalibration] = useState<'slow' | 'right' | 'fast' | null>(null);
  const [pickedMode, setPickedMode] = useState<PresetModeId>(initialModeId ?? DEFAULT_ONBOARDING_MODE);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearDemo = useCallback(() => {
    if (timeoutRef.current !== null) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (autoAdvanceRef.current !== null) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
  }, []);

  const launchDemo = useCallback(() => {
    clearDemo();
    setDemoIndex(0);
    setDemoFinished(false);
    setCurrentDemoWpm(200);
    setShowAnnotation(false);
    setCalibratedWpm(null);
    setSelectedCalibration(null);

    const scheduleNext = (idx: number) => {
      const baseMs = getDemoIntervalMs(idx);
      const extraMs = idx === ORP_ANNOTATION_INDEX ? ORP_ANNOTATION_EXTRA_MS : 0;
      timeoutRef.current = setTimeout(() => {
        // Show annotation exactly when this word is displayed
        setShowAnnotation(idx === ORP_ANNOTATION_INDEX);
        const next = idx + 1;
        if (next >= DEMO_WORDS.length) {
          setDemoFinished(true);
          return;
        }
        setDemoIndex(next);
        setCurrentDemoWpm(getSegmentWpm(next));
        scheduleNext(next);
      }, baseMs + extraMs);
    };

    scheduleNext(0);
  }, [clearDemo]);

  // Fade in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-play on mount
  useEffect(() => { launchDemo(); }, [launchDemo]);

  // Cleanup on unmount
  useEffect(() => () => clearDemo(), [clearDemo]);

  // Clear ORP annotation after a short display window
  useEffect(() => {
    if (!showAnnotation) return;
    // Dismiss 100ms before the extra pause ends so the fade-out completes cleanly
    const t = setTimeout(() => setShowAnnotation(false), ORP_ANNOTATION_EXTRA_MS - 100);
    return () => clearTimeout(t);
  }, [showAnnotation]);

  const advance = useCallback(() => {
    if (step < 2) {
      setStep(step + 1);
      if (step === 0) clearDemo();
    } else {
      onComplete({
        theme: initialTheme ?? DEFAULT_ONBOARDING_THEME,
        modeId: pickedMode,
        wpm: calibratedWpm ?? undefined,
        action: null,
      });
    }
  }, [step, onComplete, clearDemo, initialTheme, pickedMode, calibratedWpm]);

  const goBack = useCallback(() => {
    if (step <= 0) return;
    setStep(step - 1);
    if (step - 1 === 0) launchDemo();
  }, [step, launchDemo]);

  const skip = useCallback(() =>
    onComplete({ theme: initialTheme ?? DEFAULT_ONBOARDING_THEME, modeId: DEFAULT_ONBOARDING_MODE }),
    [onComplete, initialTheme]);

  // Keyboard: Enter advances, Escape skips
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter') advance(); if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [advance, skip]);

  function handleCalibration(label: 'slow' | 'right' | 'fast', wpm: number) {
    setSelectedCalibration(label);
    setCalibratedWpm(wpm);
    // Auto-advance to Step 1 after 1200ms — long enough to see selection feedback
    autoAdvanceRef.current = setTimeout(() => {
      setStep(1);
      clearDemo();
    }, 1200);
  }

  const rawWord = demoIndex >= 0 && demoIndex < DEMO_WORDS.length ? DEMO_WORDS[demoIndex] : '';
  const orpIdx  = calcOrpIndex(rawWord);
  const preORP  = rawWord.slice(0, orpIdx);
  const orpChar = rawWord[orpIdx] ?? '';
  const postORP = rawWord.slice(orpIdx + 1);

  return (
    <div className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}
         role="dialog" aria-modal="true" aria-label="Welcome to PaceRead">
      <div className={styles.panel}>

        <div className={styles.stepContent} key={step}>

          {/* Step 0 — Demo + Calibration */}
          {step === 0 && (
            <div className={styles.step}>
              <h1 className={styles.heading}>
                {demoFinished ? 'How did that feel?' : <>Your eyes stay still.<br />Words come to you.</>}
              </h1>

              {/* Demo viewport — hidden after demo finishes */}
              {!demoFinished && (
                <div className={styles.demoViewport} aria-live="polite" aria-atomic="true">
                  <div className={styles.demoTickTop}    aria-hidden="true" />
                  <div className={styles.demoTickBottom} aria-hidden="true" />
                  <div className={styles.demoWordRow}>
                    <span className={styles.demoPreOrp}>{preORP}</span>
                    <span className={styles.demoOrpChar}>{orpChar}</span>
                    <span className={styles.demoPostOrp}>{postORP}</span>
                  </div>
                  {showAnnotation && (
                    <div className={styles.orpAnnotation} aria-hidden="true">← lock-on letter</div>
                  )}
                </div>
              )}

              {/* Caption / calibration */}
              {!demoFinished && (
                <>
                  <p className={styles.demoCaption}>{currentDemoWpm} WPM — eyes stay still</p>
                  <div className={styles.wpmChip} aria-hidden="true">
                    <span className={styles.wpmDot} />{currentDemoWpm} WPM
                  </div>
                </>
              )}

              {demoFinished && (
                <>
                  <div className={styles.calibrationStack}>
                    {([
                      { label: 'slow'  as const, wpm: 350, text: '⚡  Too slow — I want faster' },
                      { label: 'right' as const, wpm: 250, text: '✓  Just right'               },
                      { label: 'fast'  as const, wpm: 175, text: '🐢  A bit fast for me'        },
                    ]).map(opt => (
                      <button key={opt.label} type="button"
                        className={`${styles.calibrationBtn} ${selectedCalibration === opt.label ? styles.calibrationBtnSelected : ''}`}
                        onClick={() => handleCalibration(opt.label, opt.wpm)}>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                  <p className={styles.demoCaption}>Your starting speed. Change anytime.</p>
                </>
              )}
            </div>
          )}

          {/* Step 1 — Mode selection */}
          {step === 1 && (
            <div className={styles.step}>
              <h1 className={styles.heading}>Choose your reading style</h1>
              <p className={styles.body}>You can change this anytime in settings.</p>
              <div className={styles.modeStack}>
                {MODES.map(m => (
                  <button key={m.id} type="button"
                    className={`${styles.modeStackBtn} ${pickedMode === m.id ? styles.modeStackBtnActive : ''}`}
                    onClick={() => { setPickedMode(m.id); selectPresetMode(m.id); }}
                    aria-pressed={pickedMode === m.id}>
                    <span className={styles.modeStackEmoji} aria-hidden="true">{m.emoji}</span>
                    <span className={styles.modeStackLabel}>{m.label}</span>
                    <span className={styles.modeStackWpm} style={{ color: m.accent }}>{m.wpm}</span>
                    <span className={styles.modeStackDesc}>{m.desc}</span>
                    {m.recommended && <span className={styles.modeStackBadge}>Recommended</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Action cards */}
          {step === 2 && (
            <div className={styles.step}>
              <h1 className={styles.heading}>Load something and begin.</h1>
              <div className={styles.actionCards}>

                <button type="button" className={styles.actionCardBtn}
                  onClick={() => fileInputRef.current?.click()}>
                  <span className={styles.actionCardIcon} aria-hidden="true">📂</span>
                  <div>
                    <strong className={styles.actionCardTitle}>Upload a file</strong>
                    <span className={styles.actionCardDesc}>PDF · EPUB · DOCX · TXT · MD · HTML · SRT</span>
                  </div>
                </button>

                <button type="button" className={styles.actionCardBtn}
                  onClick={() => onComplete({
                    theme: initialTheme ?? DEFAULT_ONBOARDING_THEME,
                    modeId: pickedMode,
                    wpm: calibratedWpm ?? undefined,
                    action: 'paste',
                  })}>
                  <span className={styles.actionCardIcon} aria-hidden="true">📋</span>
                  <div>
                    <strong className={styles.actionCardTitle}>Paste text or a URL</strong>
                    <span className={styles.actionCardDesc}>Copy from anywhere — clipboard auto-detected</span>
                  </div>
                </button>

                <button type="button" className={styles.actionCardBtn}
                  onClick={() => onComplete({
                    theme: initialTheme ?? DEFAULT_ONBOARDING_THEME,
                    modeId: pickedMode,
                    wpm: calibratedWpm ?? undefined,
                    action: 'story',
                  })}>
                  <span className={styles.actionCardIcon} aria-hidden="true">📖</span>
                  <div>
                    <strong className={styles.actionCardTitle}>Read a practice story</strong>
                    <span className={styles.actionCardDesc}>Short story · ~180 words · about 45 seconds at 250 WPM</span>
                  </div>
                </button>

              </div>
              <button type="button" className={styles.actionCardLater} onClick={advance}>
                I'll decide later →
              </button>
              <p className={styles.privacyNote}>🔒 All processing is on your device. Nothing leaves.</p>

              <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.epub,.docx,.txt,.md,.html,.htm,.rtf,.srt"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  onFileSelect(f);
                  onComplete({
                    theme: initialTheme ?? DEFAULT_ONBOARDING_THEME,
                    modeId: pickedMode,
                    wpm: calibratedWpm ?? undefined,
                    action: 'file',
                  });
                }} />
            </div>
          )}

        </div>

        <div className={styles.navRow}>
          {step > 0 && (
            <button type="button" className={styles.btnBack} onClick={goBack} aria-label="Go back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div className={styles.dotsCenter} aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map(i => (
              <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} aria-hidden="true" />
            ))}
          </div>
          {step === 0 && (
            <button type="button" className={styles.btnReplay} onClick={launchDemo} aria-label="Replay demo">↺</button>
          )}
        </div>

        <div className={styles.actions}>
          {step < 2 && (
            <button type="button" className={styles.btnPrimary} onClick={advance}>
              Continue →
            </button>
          )}
          <button type="button" className={styles.btnSkip} onClick={skip}>
            skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
