/**
 * BurgerMenu
 *
 * Hamburger icon (top-left) that opens a slide-in settings drawer.
 *
 * Drawer contains (in order):
 *   • Reading Profile selector (quick presets)
 *   • Display: theme, orientation, font size, key letter color
 *   • Session Analytics (unified history + current session + resume)
 *   • Reset to Defaults
 *   • About
 *
 * State notes:
 *   - Opens/closes locally (no reading-state side effects).
 *   - All settings write directly to ReaderContext which persists to localStorage.
 *   - Drawer is closed whenever a file is selected from history.
 *   - During active reading (isPlaying), Display section is collapsed by default.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReaderContext } from '../context/useReaderContext';
import SessionStats from './SessionStats';
import ReadingModes from './ReadingModes';
import type { Orientation, Theme } from '../context/readerContextDef';
import { APP_VERSION } from '../version';
import { IndexedDBService } from '../sync/IndexedDBService';
import { getThemeOrpAccent } from '../config/orpColors';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/useAuth';
import styles from '../styles/BurgerMenu.module.css';
import { Share } from '@capacitor/share';
import { isNative } from '../utils/platform';

const THEME_ICONS: Record<Theme, string> = {
  obsidian: '🌑',
  midnight: '🌙',
  warm: '🕯️',
  day: '☀️',
};

const FEEDBACK_FORM_URL = 'https://forms.gle/dCBSTs4SjvhmA3Zh6';
const PRIVACY_POLICY_URL = 'https://www.techscript.ca/privacy';

// Default preference values (mirrored from ReaderContext)
const DEFAULT_WPM = 250;
const DEFAULT_THEME = 'midnight' as const;
const DEFAULT_HIGHLIGHT_COLOR = getThemeOrpAccent(DEFAULT_THEME); // midnight accent
const DEFAULT_ORIENTATION = 'horizontal' as Orientation;
const DEFAULT_MAIN_FONT_SIZE = 100;

// localStorage keys cleared when user resets to defaults
const RESETTABLE_KEYS = [
  'fastread_window_size', 'fastread_wpm', 'fastread_orientation',
  'fastread_focal_line', 'fastread_orp', 'fastread_peripheral_fade',
  'fastread_punct_pause', 'fastread_long_word_comp', 'fastread_chunk_mode',
  'fastread_main_font_size', 'fastread_highlight_color', 'fastread_active_mode',
  'fastread_active_custom_mode_id', 'fastread_theme',
] as const;

interface BurgerMenuProps {
  onFileSelect: (file: File) => void;
  onReplayIntro?: () => void;
  onResumeFromCache: (name: string) => void;
  onClearAll: () => void;
}

export default function BurgerMenu({ onFileSelect, onReplayIntro, onResumeFromCache, onClearAll }: BurgerMenuProps) {
  const [open, setOpen] = useState(false);

  const {
    setWindowSize,
    setOrientation,
    setHighlightColor,
    setMainWordFontSize,
    theme, setTheme,
    setWpm,
    isPlaying,
    setFocalLine,
    setOrpEnabled,
    setPeripheralFade,
    setPunctuationPause,
    setLongWordCompensation,
    setChunkMode,
    setActiveMode,
    setActiveCustomModeId,
  } = useReaderContext();
  const [confirmReset, setConfirmReset] = useState(false);

  const {
    isAuthenticated,
    isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth();
  const accountName = (user?.user_metadata?.['full_name'] as string | undefined)
    ?? user?.email
    ?? 'User';

  // During active reading, advanced settings are collapsed unless user expands them.
  // Resets every time the menu is opened while playing (so re-opening the menu during
  // an active session always starts collapsed).
  const [showAdvancedDuringReading, setShowAdvancedDuringReading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Open menu; collapse advanced settings if reading is in progress
  const handleOpen = useCallback(() => {
    if (isPlaying) setShowAdvancedDuringReading(false);
    setOpen(true);
  }, [isPlaying]);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  // Trap focus inside panel when open (accessibility)
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Wrap file select so the menu closes when a history item triggers re-load
  const handleHistoryFileSelect = useCallback(
    (file: File) => {
      close();
      onFileSelect(file);
    },
    [close, onFileSelect],
  );

  // Wrap resume so the menu closes when a cached session is resumed
  const handleResumeFromCache = useCallback(
    (name: string) => {
      close();
      onResumeFromCache(name);
    },
    [close, onResumeFromCache],
  );

  // Reset all user preferences to new-user defaults
  const handleResetDefaults = useCallback(() => {
    RESETTABLE_KEYS.forEach(key => { try { localStorage.removeItem(key); } catch { /* ignore */ } });
    setTheme(DEFAULT_THEME);
    setHighlightColor(DEFAULT_HIGHLIGHT_COLOR);
    setOrientation(DEFAULT_ORIENTATION);
    setMainWordFontSize(DEFAULT_MAIN_FONT_SIZE);
    setWpm(DEFAULT_WPM);
    setWindowSize(1);
    setFocalLine(true);
    setOrpEnabled(true);
    setPeripheralFade(false);
    setPunctuationPause(true);
    setLongWordCompensation(true);
    setChunkMode('fixed');
    setActiveMode('focus');
    setActiveCustomModeId(null);
    // Clear IndexedDB preferences
    IndexedDBService.savePreferences({
      theme: DEFAULT_THEME,
      fontSize: DEFAULT_MAIN_FONT_SIZE,
      wordWindow: 1,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      updatedAt: new Date(),
    }).catch(() => { /* ignore */ });
    setConfirmReset(false);
    toast.success('Settings reset to defaults');
  }, [setTheme, setHighlightColor, setOrientation, setMainWordFontSize, setWpm,
    setWindowSize, setFocalLine, setOrpEnabled, setPeripheralFade,
    setPunctuationPause, setLongWordCompensation, setChunkMode,
    setActiveMode, setActiveCustomModeId]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: 'PaceRead — Speed Reader',
        text: 'Check out PaceRead — a free RSVP speed reader that works with any PDF or EPUB.',
        url: 'https://paceread.techscript.ca',
        dialogTitle: 'Share PaceRead',
      });
    } catch {
      // User cancelled share sheet — not an error
    }
  }, []);

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        className={styles.burgerBtn}
        onClick={handleOpen}
        aria-label="Open settings menu"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </button>

      {/* Portal escapes .topBar's backdrop-filter compositing layer (WebKit bug #224093):
          position:fixed descendants are trapped inside their backdrop-filter ancestor on iOS Safari.
          Rendering to document.body breaks out of that layer so the overlay covers the full screen. */}
      {open && createPortal(
        /* Backdrop */
        <div className={styles.backdrop} onClick={close} aria-hidden="true">
          {/* Drawer — stop propagation so clicks inside don't close */}
          <div
            ref={panelRef}
            className={styles.panel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Settings menu"
            tabIndex={-1}
          >
            {/* ── Drawer header ───────────────────────────────── */}
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>PaceRead</span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close settings menu"
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerBody}>

              {/* ── Reading Modes ──────────────────────────────────── */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Reading Mode</h3>
                <ReadingModes />
              </section>

              {/* ── Minimal-UI notice during active reading ─────────── */}
              {isPlaying && !showAdvancedDuringReading && (
                <div className={styles.readingActiveBar}>
                  <span className={styles.readingActiveDot} aria-hidden="true" />
                  <span className={styles.readingActiveLabel}>Reading in progress</span>
                  <button
                    type="button"
                    className={styles.showSettingsBtn}
                    onClick={() => setShowAdvancedDuringReading(true)}
                  >
                    Show Settings
                  </button>
                </div>
              )}

              {/* ── Theme ────────────────────────────────────────── */}
              {(!isPlaying || showAdvancedDuringReading) && (
              <>
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Theme</h3>
                </div>

                <div className={styles.themeRow}>
                  {(['midnight', 'warm', 'day', 'obsidian'] as const).map(t => (
                    <button
                      type="button"
                      key={t}
                      className={`${styles.themeBtn} ${theme === t ? styles.themeBtnActive : ''}`}
                      onClick={() => setTheme(t)}
                      aria-pressed={theme === t}
                      title={t.charAt(0).toUpperCase() + t.slice(1)}
                    >
                      <span className={styles.themeIcon} aria-hidden="true">{THEME_ICONS[t]}</span>
                      <span className={styles.themeLabel}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    </button>
                  ))}
                </div>

              </section>

              </>) /* end (!isPlaying || showAdvancedDuringReading) */}

              {/* ── Session Analytics (unified: current session + history + resume) ── */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Session Analytics</h3>
                <SessionStats onFileSelect={handleHistoryFileSelect} onResumeFromCache={handleResumeFromCache} onClearAll={onClearAll} />
              </section>

              {/* ── Reset to Defaults ───────────────────────────────── */}
              <section className={styles.section}>
                {confirmReset ? (
                  <div className={styles.confirmReset}>
                    <span className={styles.confirmResetText}>Reset all settings to defaults?</span>
                    <div className={styles.confirmResetActions}>
                      <button
                        type="button"
                        className={styles.confirmResetYes}
                        onClick={handleResetDefaults}
                      >
                        Yes, reset
                      </button>
                      <button
                        type="button"
                        className={styles.confirmResetNo}
                        onClick={() => setConfirmReset(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.resetBtn}
                    onClick={() => setConfirmReset(true)}
                  >
                    Reset to Defaults
                  </button>
                )}
              </section>

              {/* ── Account ────────────────────────────────────────────── */}
              {isSupabaseConfigured && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Account</h3>
                  {isAuthenticated ? (
                    <div className={styles.accountRow}>
                      <span className={styles.accountName}>{accountName}</span>
                      <button
                        type="button"
                        className={styles.signOutBtn}
                        onClick={() => {
                          if (confirm('Sign out?')) {
                            signOut();
                            close();
                          }
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.signInBurgerBtn}
                      onClick={() => { signInWithGoogle(); close(); }}
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                           stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Sign in to sync reading
                    </button>
                  )}
                </section>
              )}

              {/* ── About ───────────────────────────────────────── */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>About</h3>
                <p className={styles.aboutText}>
                  PaceRead {APP_VERSION}
                </p>
                <p className={styles.aboutText}>
                  Powered by{' '}
                  <a
                    href="https://www.techscript.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.aboutLink}
                  >
                    Techscript
                  </a>
                </p>
                <a
                  href={FEEDBACK_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkBtn}
                >
                  💬 Send Feedback
                </a>
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkBtn}
                >
                  🔒 Privacy Policy
                </a>
                {isNative() && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={handleShare}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
                      <circle cx="18" cy="5" r="3"/>
                      <circle cx="6" cy="12" r="3"/>
                      <circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Share App
                  </button>
                )}
                {onReplayIntro && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => { close(); onReplayIntro(); }}
                  >
                    ↩ Replay intro
                  </button>
                )}
              </section>

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
