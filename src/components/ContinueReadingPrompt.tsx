/**
 * ContinueReadingPrompt
 * Shown when a user signs in on a new device and loads a file that matches
 * an existing synced file — asks if they want to continue from where they left off.
 */

import styles from '../styles/ContinueReadingPrompt.module.css';

interface ContinueReadingPromptProps {
  deviceName: string;
  lastPage: number;
  lastWordIndex: number;
  onContinue: () => void;
  onStartOver: () => void;
}

export default function ContinueReadingPrompt({
  deviceName,
  lastPage,
  lastWordIndex,
  onContinue,
  onStartOver,
}: ContinueReadingPromptProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Continue reading prompt">
      <div className={styles.card}>
        <h2 className={styles.title}>Continue Reading?</h2>
        <p className={styles.message}>
          You were last reading this book on <strong>{deviceName}</strong>.
          Continue from page {lastPage}, word {lastWordIndex.toLocaleString()}?
        </p>
        <div className={styles.actions}>
          <button className={styles.continueBtn} onClick={onContinue}>
            Continue
          </button>
          <button className={styles.startOverBtn} onClick={onStartOver}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
