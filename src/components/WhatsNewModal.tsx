/**
 * WhatsNewModal — non-blocking bottom banner, shown once per app version.
 * Appears before onboarding on version bumps.
 */

import { useState } from 'react';
import { APP_VERSION } from '../version';
import styles from '../styles/WhatsNewModal.module.css';

interface WhatsNewEntry {
  icon: string;
  title: string;
  body: string;
}

const WHATS_NEW: WhatsNewEntry[] = [
  { icon: '🔵', title: 'Smooth Page Preview', body: 'Page Preview no longer jitters. The highlighted word walks down and snaps back up — no more vibrating text.' },
  { icon: '↩', title: 'Return to Current Position', body: 'When browsing away in Page Preview, tap "↩ current" to jump instantly back to where you\'re reading.' },
  { icon: '🚫', title: 'Top Bar Simplified', body: 'Page number removed from the top bar — it\'s already visible in the viewport overlay and Page Preview.' },
];

interface WhatsNewModalProps {
  onDismiss: () => void;
}

export default function WhatsNewModal({ onDismiss }: WhatsNewModalProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.banner} role="region" aria-label="What's new in PaceRead">
      <div className={styles.row}>
        <span className={styles.sparkle} aria-hidden="true">✨</span>
        <span className={styles.label}>What's new in {APP_VERSION}</span>
        <button
          type="button"
          className={styles.expandBtn}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'See what\'s new'}
        </button>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={onDismiss}
          aria-label="Dismiss what's new banner"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <ul className={styles.list} role="list">
          {WHATS_NEW.map((entry) => (
            <li key={entry.title} className={styles.item}>
              <span className={styles.icon} aria-hidden="true">{entry.icon}</span>
              <div className={styles.text}>
                <span className={styles.itemTitle}>{entry.title}</span>
                <span className={styles.itemBody}>{entry.body}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
