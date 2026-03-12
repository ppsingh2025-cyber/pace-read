/**
 * WordNavigator
 *
 * Word-level navigation bar. Allows the user to:
 *  - Step one word back / forward with arrow buttons
 *  - Click the "current / total" display to type an exact word number and jump
 *
 * Rendered only when words are loaded.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import styles from '../styles/WordNavigator.module.css';

interface WordNavigatorProps {
  onPrevWord: () => void;
  onNextWord: () => void;
}

export default memo(function WordNavigator({ onPrevWord, onNextWord }: WordNavigatorProps) {
  const { words, currentWordIndex, goToWord, isLoading } = useReaderContext();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Select all text when input appears so the user can type immediately
  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const hasWords = words.length > 0 && !isLoading;

  const startEditing = useCallback(() => {
    setInputValue(String(currentWordIndex + 1));
    setIsEditing(true);
  }, [currentWordIndex]);

  const commitEdit = useCallback(() => {
    const word = parseInt(inputValue, 10);
    if (!isNaN(word) && word >= 1 && word <= words.length) {
      goToWord(word - 1);
    }
    setIsEditing(false);
  }, [inputValue, goToWord, words.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setIsEditing(false);
    },
    [commitEdit],
  );

  if (!hasWords) return null;

  return (
    <div className={styles.wordNav} aria-label="Word navigation">
      <span className={styles.label}>Word</span>

      <button
        className={styles.navBtn}
        onClick={onPrevWord}
        disabled={currentWordIndex <= 0}
        title="Previous word (←)"
        aria-label="Previous word"
      >
        ‹
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.wordInput}
          type="number"
          min={1}
          max={words.length}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          aria-label={`Go to word (1–${words.length})`}
        />
      ) : (
        <button
          className={styles.wordDisplay}
          onClick={startEditing}
          title="Click to jump to a specific word"
          aria-label={`Word ${currentWordIndex + 1} of ${words.length} — click to jump`}
        >
          {currentWordIndex + 1}
          <span className={styles.separator}>/</span>
          {words.length}
        </button>
      )}

      <button
        className={styles.navBtn}
        onClick={onNextWord}
        disabled={currentWordIndex >= words.length - 1}
        title="Next word (→)"
        aria-label="Next word"
      >
        ›
      </button>
    </div>
  );
})
