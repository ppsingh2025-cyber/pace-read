/**
 * InputPanel
 *
 * Provides two alternative input modes beyond file upload:
 *   1. Paste Text  – large textarea; user pastes article/book text directly
 *   2. URL Reader  – user provides a URL; text is fetched and extracted
 *
 * Both modes call the `onTextReady` callback with the extracted words array
 * so they plug directly into the same parsing pipeline as file uploads.
 */

import { useCallback, useState } from 'react';
import { parseRawText } from '../parsers/textParser';
import { parseUrl } from '../parsers/urlParser';
import styles from '../styles/InputPanel.module.css';

type InputMode = 'paste' | 'url';

interface InputPanelProps {
  /** Called when text has been extracted and is ready for the reading engine */
  onTextReady: (words: string[], sourceName: string) => void;
}

export default function InputPanel({ onTextReady }: InputPanelProps) {
  const [mode, setMode] = useState<InputMode>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── Paste mode ─────────────────────────────────────────────── */
  const handlePasteSubmit = useCallback(() => {
    setError(null);
    const trimmed = pasteValue.trim();
    if (!trimmed) {
      setError('Please paste some text before loading.');
      return;
    }
    const { words } = parseRawText(trimmed, 'paste');
    if (words.length === 0) {
      setError('No readable words found in the pasted text.');
      return;
    }
    onTextReady(words, 'Pasted text');
    setPasteValue('');
  }, [pasteValue, onTextReady]);

  /* ── URL mode ────────────────────────────────────────────────── */
  const handleUrlSubmit = useCallback(async () => {
    setError(null);
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setError('Please enter a URL.');
      return;
    }
    setLoading(true);
    try {
      const { words, metadata } = await parseUrl(trimmed);
      if (words.length === 0) {
        setError('No readable text found at that URL.');
        return;
      }
      onTextReady(words, metadata?.title ?? trimmed);
      setUrlValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL.');
    } finally {
      setLoading(false);
    }
  }, [urlValue, onTextReady]);

  const handleUrlKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleUrlSubmit();
    },
    [handleUrlSubmit],
  );

  return (
    <div className={styles.panel}>
      {/* Mode tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          className={mode === 'paste' ? styles.tabActive : styles.tab}
          onClick={() => { setMode('paste'); setError(null); }}
          role="tab"
          aria-selected={mode === 'paste'}
        >
          📋 Paste text
        </button>
        <button
          className={mode === 'url' ? styles.tabActive : styles.tab}
          onClick={() => { setMode('url'); setError(null); }}
          role="tab"
          aria-selected={mode === 'url'}
        >
          🔗 URL reader
        </button>
      </div>

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className={styles.modeBody}>
          <textarea
            className={styles.textarea}
            placeholder="Paste your article, book excerpt, or any text here…"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            rows={6}
            aria-label="Paste text to read"
          />
          <button
            className={styles.submitBtn}
            onClick={handlePasteSubmit}
            disabled={!pasteValue.trim()}
          >
            Load text ▶
          </button>
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div className={styles.modeBody}>
          <input
            className={styles.urlInput}
            type="url"
            placeholder="https://example.com/article"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={handleUrlKey}
            aria-label="Article URL to fetch"
            disabled={loading}
          />
          <button
            className={styles.submitBtn}
            onClick={handleUrlSubmit}
            disabled={!urlValue.trim() || loading}
          >
            {loading ? 'Fetching…' : 'Fetch & read ▶'}
          </button>
          <p className={styles.hint}>
            Note: some sites block cross-origin requests. If fetching fails, paste
            the text directly instead.
          </p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
