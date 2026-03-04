/**
 * SyncService
 * Orchestrates syncing between IndexedDB and Supabase.
 * Conservative sync strategy: only syncs on explicit events (pause, stop, close, manual).
 * All sync operations are no-ops when Supabase is not configured or user is not authenticated.
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import { IndexedDBService } from './IndexedDBService';
import { getDeviceName } from './deviceDetector';
import type { FileMetadata, UserPreferences, ReadingSession, SyncStatus } from '../types/metadata';

type SyncTrigger = 'pause' | 'stop' | 'close' | 'manual';
type SyncStatusListener = (status: SyncStatus) => void;

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSyncUserId: string | null = null;
const DEBOUNCE_MS = 2000;

const listeners = new Set<SyncStatusListener>();
let currentStatus: SyncStatus = {
  isSyncing: false,
  isOnline: navigator.onLine,
  hasUnsyncedChanges: false,
};

function updateStatus(patch: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...patch };
  listeners.forEach((fn) => fn(currentStatus));
}

window.addEventListener('online', () => updateStatus({ isOnline: true }));
window.addEventListener('offline', () => updateStatus({ isOnline: false }));

export const SyncService = {
  getStatus(): SyncStatus {
    return currentStatus;
  },

  subscribe(listener: SyncStatusListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async triggerSync(reason: SyncTrigger, userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    if (!navigator.onLine) {
      updateStatus({ hasUnsyncedChanges: true });
      return;
    }

    // Debounce rapid calls — only the last caller within the window runs
    pendingSyncUserId = userId;
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    if (reason === 'close') {
      // Synchronous-ish path for beforeunload
      await this._performSync(userId);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      syncDebounceTimer = setTimeout(() => {
        const uid = pendingSyncUserId ?? userId;
        this._performSync(uid).then(resolve).catch(reject);
      }, DEBOUNCE_MS);
    });
  },

  async _performSync(userId: string): Promise<void> {
    if (!supabase) return;
    updateStatus({ isSyncing: true });

    try {
      // Sync file metadata
      const localFiles = await IndexedDBService.getAllFiles();
      const userFiles = localFiles.filter((f) => !f.userId || f.userId === userId);

      for (const localFile of userFiles) {
        const { data: serverFile } = await supabase
          .from('user_files')
          .select('*')
          .eq('user_id', userId)
          .eq('file_hash', localFile.fileHash)
          .maybeSingle();

        const localUpdated = localFile.updatedAt ? new Date(localFile.updatedAt).getTime() : 0;
        const serverUpdated = serverFile?.updated_at ? new Date(serverFile.updated_at as string).getTime() : 0;

        if (!serverFile || localUpdated >= serverUpdated) {
          // Push local to server
          await supabase.from('user_files').upsert({
            user_id: userId,
            file_hash: localFile.fileHash,
            file_name: localFile.fileName,
            file_type: localFile.fileType,
            file_size: localFile.fileSize,
            last_word_index: localFile.lastWordIndex,
            last_page: localFile.lastPage,
            total_pages: localFile.totalPages,
          }, { onConflict: 'user_id,file_hash' });
        } else {
          // Pull from server
          await IndexedDBService.saveFileMetadata({
            ...localFile,
            lastWordIndex: serverFile.last_word_index as number,
            lastPage: serverFile.last_page as number,
            totalPages: serverFile.total_pages as number,
            updatedAt: new Date(serverFile.updated_at as string),
          });
        }
      }

      // Sync preferences
      const localPrefs = await IndexedDBService.getPreferences();
      if (localPrefs) {
        const { data: serverPrefs } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        const localUpdated = localPrefs.updatedAt ? new Date(localPrefs.updatedAt).getTime() : 0;
        const serverUpdated = serverPrefs?.updated_at ? new Date(serverPrefs.updated_at as string).getTime() : 0;

        if (!serverPrefs || localUpdated >= serverUpdated) {
          await supabase.from('user_preferences').upsert({
            user_id: userId,
            theme: localPrefs.theme,
            font_size: localPrefs.fontSize,
            word_window: localPrefs.wordWindow,
            highlight_color: localPrefs.highlightColor,
          }, { onConflict: 'user_id' });
        } else {
          await IndexedDBService.savePreferences({
            ...localPrefs,
            theme: serverPrefs.theme as UserPreferences['theme'],
            fontSize: serverPrefs.font_size as number,
            wordWindow: serverPrefs.word_window as UserPreferences['wordWindow'],
            highlightColor: serverPrefs.highlight_color as string,
            updatedAt: new Date(serverPrefs.updated_at as string),
          });
        }
      }

      updateStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        hasUnsyncedChanges: false,
      });
    } catch (err) {
      console.error('[SyncService] Sync failed:', err);
      updateStatus({ isSyncing: false, hasUnsyncedChanges: true });
      throw err;
    }
  },

  async saveReadingSession(session: Omit<ReadingSession, 'deviceName'>): Promise<void> {
    const deviceName = getDeviceName();
    const fullSession: ReadingSession = { ...session, deviceName };
    await IndexedDBService.saveSession(fullSession);

    // If online and authenticated, also push to Supabase
    if (isSupabaseConfigured && supabase && navigator.onLine && session.userId) {
      try {
        await supabase.from('reading_sessions').insert({
          user_id: session.userId,
          file_id: session.fileId,
          session_start: session.sessionStart.toISOString(),
          session_end: session.sessionEnd?.toISOString(),
          words_read: session.wordsRead,
          start_word_index: session.startWordIndex,
          end_word_index: session.endWordIndex,
          device_name: deviceName,
        });
      } catch (err) {
        console.warn('[SyncService] Failed to push session to Supabase:', err);
      }
    }
  },

  async getFileFromServer(userId: string, fileHash: string): Promise<FileMetadata | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id as string,
      userId: data.user_id as string,
      fileHash: data.file_hash as string,
      fileName: data.file_name as string,
      fileType: data.file_type as FileMetadata['fileType'],
      fileSize: data.file_size as number,
      lastWordIndex: data.last_word_index as number,
      lastPage: data.last_page as number,
      totalPages: data.total_pages as number,
      updatedAt: new Date(data.updated_at as string),
    };
  },
};
