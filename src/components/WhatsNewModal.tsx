/**
 * WhatsNewModal — shown once per app version.
 * Appears before onboarding on version bumps.
 */

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
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="What's new in PaceRead">
      <div className={styles.card}>

        <div className={styles.header}>
          <span className={styles.badge}>{APP_VERSION}</span>
          <h2 className={styles.title}>What's New</h2>
          <p className={styles.subtitle}>PaceRead just got better</p>
        </div>

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

        <button type="button" className={styles.cta} onClick={onDismiss} autoFocus>
          Got it — let's read
        </button>

      </div>
    </div>
  );
}
