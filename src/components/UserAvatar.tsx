/**
 * UserAvatar
 * Shows the user's Google profile picture (or a placeholder) in the header.
 * Only visible when Supabase is configured.
 */

import { useAuth } from '../auth/useAuth';
import styles from '../styles/UserAvatar.module.css';

export default function UserAvatar() {
  const { user, isAuthenticated, isSupabaseConfigured, signInWithGoogle } = useAuth();
  if (!isSupabaseConfigured) return null;

  const avatarUrl = user?.user_metadata?.['avatar_url'] as string | undefined;
  const displayName = user?.user_metadata?.['full_name'] as string | undefined ?? user?.email ?? 'User';

  if (!isAuthenticated) {
    return (
      <button
        className={styles.signInBtn}
        onClick={signInWithGoogle}
        title="Sign in to sync your reading across devices"
        aria-label="Sign in with Google"
      >
        Sign in
      </button>
    );
  }

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={displayName}
      className={styles.avatarImg}
      title={displayName}
    />
  ) : (
    <div className={styles.avatarInitial} title={displayName} aria-label={displayName}>
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}
