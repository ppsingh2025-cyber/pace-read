/**
 * AppFooter
 *
 * Minimal footer showing "Buy Me a Coffee" support link (web only) and
 * "Powered by Techscript" attribution.
 *
 * The donation link is suppressed in native Android/iOS builds to comply with
 * Google Play policy and Apple App Store guideline 3.1.1, which prohibit
 * external payment links in the native UI.
 *
 * VITE_IS_NATIVE=true at build time strips the donation link.
 */

import styles from '../styles/AppFooter.module.css';

// Build-time flag injected by vite.config.ts define block.
// In web builds this is 'false'; in Android/iOS CI builds it is 'true'.
const IS_NATIVE = (import.meta.env.VITE_IS_NATIVE ?? 'false') === 'true';

export default function AppFooter() {
  return (
    <footer className={styles.footer}>
      {!IS_NATIVE && (
        <>
          <a
            href="https://buymeacoffee.com/techscriptx"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            aria-label="Buy me a coffee — support PaceRead"
            title="Support PaceRead — all features stay free"
          >
            ☕ Buy me a coffee
          </a>
          <span className={styles.sep}>·</span>
        </>
      )}
      <a
        href="https://www.techscript.ca"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        Powered by Techscript
      </a>
    </footer>
  );
}
