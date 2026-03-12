/**
 * UserAvatar
 * Shows the user's Google profile picture (or a placeholder) in the header.
 * Only visible when Supabase is configured.
 */

import React from 'react';
import { useAuth } from '../auth/useAuth';
import styles from '../styles/UserAvatar.module.css';

export default function UserAvatar() {
  const { user, isAuthenticated, isSupabaseConfigured, signInWithGoogle, signOut } = useAuth();
  if (!isSupabaseConfigured) return null;

  const avatarUrl = user?.user_metadata?.['avatar_url'] as string | undefined;
  const displayName = user?.user_metadata?.['full_name'] as string | undefined ?? user?.email ?? 'User';

  const handleSignOut = () => { if (confirm('Sign out?')) signOut(); };
  const handleSignOutKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handleSignOut(); };

  if (!isAuthenticated) {
    return (
      <div
        className={styles.avatarPlaceholder}
        title="Sign in to sync across devices"
        aria-label="Account"
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        onClick={signInWithGoogle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') signInWithGoogle(); }}
      >
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
      tabIndex={0}
      onClick={handleSignOut}
      onKeyDown={handleSignOutKey}
    />
  ) : (
    <div
      className={styles.avatarInitial}
      title={displayName}
      aria-label={displayName}
      role="button"
      tabIndex={0}
      onClick={handleSignOut}
      onKeyDown={handleSignOutKey}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}
