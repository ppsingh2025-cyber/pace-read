/**
 * PageNavigator
 *
 * Displays a compact page/chapter navigation bar when the loaded file has
 * known page boundaries. Allows the user to:
 *  - Step to the previous / next page with arrow buttons
 *  - Click the "current / total" display to type an exact page number and jump
 *
 * Rendered only when totalPages > 1 so it doesn't appear for single-page or
 * un-paged content.
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import styles from '../styles/PageNavigator.module.css';

export default memo(function PageNavigator() {
  const { currentPage, totalPages, goToPage, fileMetadata } =
    useReaderContext();

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const label = fileMetadata?.type === 'epub' ? 'Ch.' : 'Page';

  const startEditing = useCallback(() => {
    setInputValue(String(currentPage));
    setIsEditing(true);
    // Focus is handled by autoFocus on the input element
  }, [currentPage]);

  const commitEdit = useCallback(() => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) goToPage(page);
    setIsEditing(false);
  }, [inputValue, goToPage, totalPages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setIsEditing(false);
    },
    [commitEdit],
  );

  if (totalPages <= 1) return null;

  return (
    <div className={styles.pageNav} aria-label="Page navigation">
      <span className={styles.pageLabel}>{label}</span>

      <button
        type="button"
        className={styles.navBtn}
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        title={`Previous ${label.toLowerCase()}`}
        aria-label={`Previous ${label.toLowerCase()}`}
      >
        ‹
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.pageInput}
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          aria-label={`Go to ${label.toLowerCase()} (1–${totalPages})`}
        />
      ) : (
        <button
          type="button"
          className={styles.pageDisplay}
          onClick={startEditing}
          title={`Jump to a specific ${label.toLowerCase()}`}
          aria-label={`${label} ${currentPage} of ${totalPages} — click to jump`}
        >
          {currentPage} <span className={styles.separator}>/</span> {totalPages}
        </button>
      )}

      <button
        type="button"
        className={styles.navBtn}
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        title={`Next ${label.toLowerCase()}`}
        aria-label={`Next ${label.toLowerCase()}`}
      >
        ›
      </button>
    </div>
  );
})
