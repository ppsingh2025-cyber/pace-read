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
  { icon: '⬛', title: 'Obsidian Theme',         body: 'True black surfaces for OLED screens — pixels off, battery saved, maximum contrast.' },
  { icon: '↺',  title: 'Reset Icon Fixed',        body: 'The reset button now shows the universally recognised counter-clockwise refresh arrow.' },
  { icon: '☰',  title: 'iOS Menu Fixed',          body: 'The three-bar hamburger icon now renders correctly on all iOS Safari versions.' },
  { icon: '⚡',  title: 'Sprint & Flow Modes',     body: 'Speed mode is now Sprint. Read mode is now Flow. IDs and settings are unchanged.' },
  { icon: '▣',  title: 'Consistent Panel Corners', body: 'The viewport, page context panel, and playback bar now share the same border radius.' },
];

interface WhatsNewModalProps {
  onDismiss: () => void;
}

export default function WhatsNewModal({ onDismiss }: WhatsNewModalProps) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="What's new in ReadSwift">
      <div className={styles.card}>

        <div className={styles.header}>
          <span className={styles.badge}>{APP_VERSION}</span>
          <h2 className={styles.title}>What's New</h2>
          <p className={styles.subtitle}>ReadSwift just got better</p>
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
