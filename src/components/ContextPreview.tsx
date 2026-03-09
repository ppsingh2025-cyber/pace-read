/**
 * ContextPreview — "Page Preview"
 *
 * Shows the current page of the loaded text using a fixed PAGE_SIZE = 80 word window.
 * viewPage follows currentWordIndex automatically but can be navigated independently.
 * Header row: label · ‹ N/total › page cluster · ▼ collapse toggle.
 * Active word auto-scrolls into view as reading advances.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import styles from '../styles/ContextPreview.module.css';

const PAGE_SIZE = 80;
const LS_KEY = 'contextPreview_collapsed';

interface ContextPreviewProps {
  onExpandChange?: (expanded: boolean) => void;
}

export default function ContextPreview({ onExpandChange }: ContextPreviewProps) {
  const { words, currentWordIndex, goToWord, isLoading } = useReaderContext();

  const [collapsed, setCollapsed] = useState<boolean>(() =>
    localStorage.getItem(LS_KEY) === 'true'
  );

  const readingPage = Math.floor(currentWordIndex / PAGE_SIZE);
  const [viewPage, setViewPage] = useState<number>(readingPage);
  const [isDetached, setIsDetached] = useState(false);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isDetached) setViewPage(readingPage);
  }, [readingPage, isDetached]);

  // Auto-scroll active word into view when index changes
  useEffect(() => {
    if (!collapsed && activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentWordIndex, collapsed]);

  const totalPages = Math.ceil(words.length / PAGE_SIZE);
  const hasWords = words.length > 0;
  const isExpanded = hasWords && !collapsed;

  const handleToggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(LS_KEY, String(next));
      onExpandChange?.(!next);
      return next;
    });
  }, [onExpandChange]);

  useEffect(() => { onExpandChange?.(!collapsed); }, []); // eslint-disable-line

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewPage(p => Math.max(0, p - 1));
    setIsDetached(true);
  }, []);

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewPage(p => Math.min(totalPages - 1, p + 1));
    setIsDetached(true);
  }, [totalPages]);

  const { pageStart, pageWords } = useMemo(() => {
    const start = viewPage * PAGE_SIZE;
    const end   = Math.min(words.length, start + PAGE_SIZE);
    return { pageStart: start, pageWords: words.slice(start, end) };
  }, [words, viewPage]);

  if (!hasWords || isLoading) return null;

  return (
    <div className={styles.preview} aria-label="Page preview">

      {/* ── Header row ── */}
      <div className={styles.headerRow}>

        {/* Label */}
        <span className={styles.headingLabel}>
          Page Preview
          {isDetached && (
            <span className={styles.detachedBadge} aria-label="Browsing away from current position">
              browsing
            </span>
          )}
        </span>

        {/* Page nav cluster — ‹ 3/42 › */}
        {totalPages > 1 && (
          <div className={styles.pageCluster}>
            <button
              type="button"
              className={styles.pageNavBtn}
              onClick={goPrev}
              disabled={viewPage <= 0}
              aria-label="Previous page"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                   width="11" height="11" aria-hidden="true">
                <polyline points="15 6 9 12 15 18"/>
              </svg>
            </button>
            <span className={styles.pageNum}>
              {viewPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageNavBtn}
              onClick={goNext}
              disabled={viewPage >= totalPages - 1}
              aria-label="Next page"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                   width="11" height="11" aria-hidden="true">
                <polyline points="9 6 15 12 9 18"/>
              </svg>
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls="page-preview-content"
          aria-label={isExpanded ? 'Collapse page preview' : 'Expand page preview'}
        >
          <span
            className={styles.chevron}
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden="true"
          >▼</span>
        </button>
      </div>

      {/* ── Content ── */}
      {isExpanded && (
        <div id="page-preview-content" className={styles.content}>
          {pageWords.map((word, i) => {
            const globalIndex = pageStart + i;
            const isActive    = globalIndex === currentWordIndex;
            return (
              <span
                key={globalIndex}
                ref={isActive ? activeWordRef : undefined}
                className={isActive ? styles.activeWord : styles.word}
                onClick={() => goToWord(globalIndex)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToWord(globalIndex);
                  }
                }}
                aria-label={`${word}${isActive ? ' (current)' : ''}`}
                aria-pressed={isActive}
              >
                {word}{' '}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
