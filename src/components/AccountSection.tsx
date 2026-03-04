/**
 * AccountSection
 * Renders the Account section inside the burger menu drawer.
 * Shows sign-in button when not authenticated, or user info + controls when signed in.
 */

import { useAuth } from '../auth/useAuth';
import { SyncService } from '../sync/SyncService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from '../styles/BurgerMenu.module.css';

export default function AccountSection() {
  const { user, isAuthenticated, isSupabaseConfigured, signInWithGoogle, signOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Account</h3>
        <p className={styles.aboutText} style={{ fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
          To enable <strong>Sign in with Google</strong> and cross-device sync, complete these 3 steps (both services are free):
        </p>
        <ol style={{ margin: '0 0 0.5rem 1.1rem', padding: 0, fontSize: '0.8rem', lineHeight: 1.7 }}>
          <li>
            Create a free project at{' '}
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
              supabase.com
            </a>
            , run the SQL migration, copy your Project URL and anon key
          </li>
          <li>
            Create OAuth credentials at{' '}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
              Google Cloud
            </a>
            , enable the Google provider in Supabase
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and fill in the two Supabase values
          </li>
        </ol>
        <p className={styles.aboutText} style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
          Full instructions (≈15 min):{' '}
          <a
            href="docs/SUPABASE_SETUP.md"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aboutLink}
          >
            docs/SUPABASE_SETUP.md
          </a>
        </p>
      </section>
    );
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      toast.error('Sign in failed. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Sign out failed');
    }
  };

  const handleSyncNow = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await SyncService.triggerSync('manual', user.id);
      toast.success('✓ Synced successfully', { duration: 2000 });
    } catch {
      toast.error('⚠️ Sync failed - will retry when online', { duration: 3000 });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Account</h3>
      {!isAuthenticated ? (
        <button className={styles.linkBtn} onClick={handleSignIn}>
          Sign In with Google
        </button>
      ) : (
        <>
          <p className={styles.aboutText}>📧 {user?.email}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={styles.linkBtn}
              onClick={handleSyncNow}
              disabled={isSyncing}
              style={{ flex: 1 }}
            >
              {isSyncing ? 'Syncing…' : '☁️ Sync Now'}
            </button>
            <button
              className={styles.linkBtn}
              onClick={handleSignOut}
              style={{ flex: 1 }}
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </section>
  );
}
