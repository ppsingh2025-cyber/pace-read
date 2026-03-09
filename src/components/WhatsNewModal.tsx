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
  { icon: '📖', title: 'Page Preview Redesigned', body: 'Prev/Next arrows now sit directly around the page number in the header. Clean and reachable.' },
  { icon: '⚙️', title: 'Fine-tune Reading Mode',  body: 'Layout, word size, and key letter color moved into Fine-tune. Display is now theme-only.' },
  { icon: '✅', title: 'Custom Mode Updates Fixed', body: 'Changing any fine-tune setting on a saved custom mode now always shows the Update button.' },
  { icon: '📌', title: 'Auto-scroll in Preview',  body: 'The highlighted word in Page Preview automatically scrolls into view as you read.' },
  { icon: '☕', title: 'Buy Me a Coffee — Sticky', body: 'The support link now stays pinned at the bottom so it\'s always reachable.' },
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
