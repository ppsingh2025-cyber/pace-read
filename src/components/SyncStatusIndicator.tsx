/**
 * SyncStatusIndicator
 * Shows a cloud icon with sync status in the header.
 * Only visible when Supabase is configured and user is authenticated.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { SyncService } from '../sync/SyncService';
import type { SyncStatus } from '../types/metadata';
import styles from '../styles/SyncStatusIndicator.module.css';

// Re-export SyncStatus type for use in other files
export type { SyncStatus };

export default function SyncStatusIndicator() {
  const { isAuthenticated, isSupabaseConfigured } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(SyncService.getStatus());

  useEffect(() => {
    return SyncService.subscribe(setStatus);
  }, []);

  if (!isSupabaseConfigured || !isAuthenticated) return null;

  let icon = '☁️✓';
  let title = 'Synced';
  let className = styles.synced;

  if (!status.isOnline) {
    icon = '☁️✗';
    title = 'Offline';
    className = styles.offline;
  } else if (status.isSyncing) {
    icon = '☁️⚠️';
    title = 'Syncing…';
    className = styles.syncing;
  } else if (status.hasUnsyncedChanges) {
    icon = '☁️⚠️';
    title = 'Unsynced changes';
    className = styles.unsynced;
  }

  return (
    <span className={`${styles.indicator} ${className}`} title={title} aria-label={title}>
      {icon}
    </span>
  );
}
