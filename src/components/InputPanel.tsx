/**
 * InputPanel v4 — text paste + URL fetch.
 *
 * Supports direct URL input (calls urlParser) and pasted text.
 * Clipboard auto-fills on open if permission granted.
 * Shows live word count + reading time estimate.
 * 100 MB text limit (enforced by character count).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseRawText } from '../parsers/textParser';
import { parseUrl } from '../parsers/urlParser';
import styles from '../styles/InputPanel.module.css';

const MAX_CHARS = 100 * 1024 * 1024; // ~100 M characters (practical upper limit for pasted text)
const MIN_CLIPBOARD_LENGTH = 20;    // minimum chars to trigger clipboard auto-fill

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTime(minutes: number): string {
  if (minutes < 1)  return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

interface InputPanelProps {
  onTextReady: (words: string[], sourceName: string, rawLines?: string[]) => void;
  onClose?: () => void;
  wpm?: number;
}

export default function InputPanel({ onTextReady, onClose, wpm = 250 }: InputPanelProps) {
  const [value,        setValue]        = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const [clipboardHit, setClipboardHit] = useState(false);
  const [isFetching,   setIsFetching]   = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const titleEditedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clipboard auto-fill on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (cancelled || text.trim().length < MIN_CLIPBOARD_LENGTH) return;
        setValue(text.slice(0, MAX_CHARS));
        setClipboardHit(true);
        textareaRef.current?.select();
      } catch {
        // Permission denied or API unavailable — silent fail
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const trimmed   = value.trim();
  const wordCount = countWords(trimmed);
  const hasContent = trimmed.length > 0;
  const readingMin = wpm > 0 && wordCount > 0 ? wordCount / wpm : 0;
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+\.\S+$/i.test(trimmed);

  // Auto-populate session title from first sentence/60 chars when user hasn't edited it
  useEffect(() => {
    if (titleEditedRef.current) return;
    if (!trimmed || isUrl) {
      setSessionTitle('');
      return;
    }
    const MAX_AUTO_TITLE = 60;
    const firstSentence = trimmed.match(/^[^.!?\n]{1,60}/)?.[0]?.trim() ?? trimmed.slice(0, MAX_AUTO_TITLE);
    setSessionTitle(firstSentence);
  }, [trimmed, isUrl]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!hasContent) {
      setError('Paste some text to get started.');
      textareaRef.current?.focus();
      return;
    }
    if (isUrl) {
      setIsFetching(true);
      try {
        const parsed = await parseUrl(trimmed);
        onTextReady(parsed.words, parsed.metadata?.title ?? 'Web article', parsed.rawLines);
        setValue('');
        titleEditedRef.current = false;
        setSessionTitle('');
        onClose?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch URL.');
      } finally {
        setIsFetching(false);
      }
      return;
    }
    const { words, rawLines } = parseRawText(trimmed, 'paste');
    if (words.length === 0) {
      setError('No readable words found in the pasted text.');
      return;
    }
    onTextReady(words, sessionTitle.trim() || 'Pasted text', rawLines);
    setValue('');
    titleEditedRef.current = false;
    setSessionTitle('');
    onClose?.();
  }, [trimmed, hasContent, isUrl, sessionTitle, onTextReady, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={styles.panel}>

      {/* Clipboard notice */}
      {clipboardHit && (
        <div className={styles.clipBanner}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="4" rx="1"/>
            <path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/>
          </svg>
          Clipboard text pasted automatically
          <button
            className={styles.clipDismiss}
            onClick={() => setClipboardHit(false)}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="Paste your article, book excerpt, or any text here… (up to 100 MB)"
        value={value}
        onChange={e => {
          setValue(e.target.value.slice(0, MAX_CHARS));
          setError(null);
          setClipboardHit(false);
        }}
        onKeyDown={handleKeyDown}
        rows={4}
        aria-label="Text to read"
        spellCheck={false}
        autoFocus={!clipboardHit}
      />

      {/* Footer: metadata + CTA */}
      <div className={styles.footer}>
        <div className={styles.meta}>
          {wordCount > 0 ? (
            <>
              <span className={styles.chip}>{wordCount.toLocaleString()} words</span>
              {readingMin > 0 && (
                <span className={styles.chip}>~{formatTime(readingMin)} at {wpm} WPM</span>
              )}
            </>
          ) : (
            <span className={styles.hint}>Ctrl+Enter to load</span>
          )}
        </div>
        <button
          className={styles.cta}
          onClick={handleSubmit}
          disabled={!hasContent || isFetching}
        >
          {isFetching ? 'Fetching…' : 'Start Reading →'}
        </button>
      </div>

      {/* Session title row — shown for non-URL pasted text */}
      {hasContent && !isUrl && (
        <div className={styles.titleRow}>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Session title (optional)"
            value={sessionTitle}
            onChange={e => {
              titleEditedRef.current = true;
              setSessionTitle(e.target.value);
            }}
            maxLength={120}
            aria-label="Session title"
          />
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

