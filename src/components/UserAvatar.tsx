/**
 * UserAvatar
 * Shows the user's Google profile picture (or a placeholder) in the header.
 * Only visible when Supabase is configured.
 */

import { useAuth } from '../auth/useAuth';
import styles from '../styles/UserAvatar.module.css';

export default function UserAvatar() {
  const { user, isAuthenticated, isSupabaseConfigured } = useAuth();
  if (!isSupabaseConfigured) return null;

  const avatarUrl = user?.user_metadata?.['avatar_url'] as string | undefined;
  const displayName = user?.user_metadata?.['full_name'] as string | undefined ?? user?.email ?? 'User';

  if (!isAuthenticated) {
    return (
      <div className={styles.avatarPlaceholder} title="Sign in to sync across devices" aria-label="Account">
        👤
      </div>
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
