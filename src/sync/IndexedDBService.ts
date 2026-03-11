/**
 * IndexedDBService
 * Local metadata storage using IndexedDB via the 'idb' library.
 * Acts as the offline-first source of truth for all metadata.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { FileMetadata, UserPreferences, ReadingSession } from '../types/metadata';

const DB_NAME = 'readswift_metadata';
const DB_VERSION = 3;

const FILE_CACHE_LIMIT = 3;
export const FILE_CACHE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB — iOS Safari quota safety

interface ReadSwiftDB {
  files: FileMetadata & { id: string };
  preferences: UserPreferences & { id: string };
  sessions: ReadingSession & { id: string };
  syncState: { key: string; value: string | number };
  cachedFiles: { name: string; buffer: ArrayBuffer; type: string; savedAt?: string };
  savedTexts: { name: string; rawText: string; savedAt: string };
}

let dbInstance: IDBPDatabase<ReadSwiftDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ReadSwiftDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ReadSwiftDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 stores
      if (oldVersion < 1) {
        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' });
          filesStore.createIndex('by-hash', 'fileHash');
          filesStore.createIndex('by-user', 'userId');
        }
        // Preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'id' });
        }
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('by-file', 'fileId');
          sessionsStore.createIndex('by-user', 'userId');
        }
        // Sync state store
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'key' });
        }
      }
      // v2: cached file blobs for auto-resume
      if (oldVersion < 2) {
        db.createObjectStore('cachedFiles', { keyPath: 'name' });
      }
      // v3: savedTexts store for pasted/URL text sessions
      if (oldVersion < 3) {
        db.createObjectStore('savedTexts', { keyPath: 'name' });
      }
    },
  });
  return dbInstance;
}

export const IndexedDBService = {
  async saveFileMetadata(meta: FileMetadata): Promise<void> {
    const db = await getDB();
    const id = meta.id ?? `file-${meta.fileHash}`;
    await db.put('files', { ...meta, id } as ReadSwiftDB['files']);
  },

  async getFileByHash(hash: string): Promise<FileMetadata | undefined> {
    const db = await getDB();
    return db.getFromIndex('files', 'by-hash', hash);
  },

  async getAllFiles(): Promise<FileMetadata[]> {
    const db = await getDB();
    return db.getAll('files');
  },

  async savePreferences(prefs: UserPreferences): Promise<void> {
    const db = await getDB();
    const id = prefs.id ?? 'user-preferences';
    await db.put('preferences', { ...prefs, id } as ReadSwiftDB['preferences']);
  },

  async getPreferences(): Promise<UserPreferences | undefined> {
    const db = await getDB();
    const all = await db.getAll('preferences');
    return all[0];
  },

  async saveSession(session: ReadingSession): Promise<void> {
    const db = await getDB();
    const id = session.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db.put('sessions', { ...session, id } as ReadSwiftDB['sessions']);
  },

  async getSessionsForFile(fileId: string): Promise<ReadingSession[]> {
    const db = await getDB();
    return db.getAllFromIndex('sessions', 'by-file', fileId);
  },

  async setSyncState(key: string, value: string | number): Promise<void> {
    const db = await getDB();
    await db.put('syncState', { key, value });
  },

  async getSyncState(key: string): Promise<string | number | undefined> {
    const db = await getDB();
    const record = await db.get('syncState', key);
    return record?.value;
  },

  async clearAllSessions(): Promise<void> {
    const db = await getDB();
    await db.clear('sessions');
  },

  async saveFileCache(name: string, buffer: ArrayBuffer, type: string): Promise<void> {
    const db = await getDB();
    await db.put('cachedFiles', { name, buffer, type, savedAt: new Date().toISOString() });
  },

  async getFileCache(name: string): Promise<{ name: string; buffer: ArrayBuffer; type: string } | undefined> {
    const db = await getDB();
    return db.get('cachedFiles', name);
  },

  async clearFileCache(): Promise<void> {
    const db = await getDB();
    await db.clear('cachedFiles');
  },

  /**
   * Prune `cachedFiles` to at most FILE_CACHE_LIMIT entries.
   * Sorts by `savedAt` descending (newest first); entries missing savedAt sort to end.
   * Returns true if any entries were deleted (caller uses this to gate eviction toast).
   */
  async pruneFileCacheToLimit(): Promise<boolean> {
    try {
      const db = await getDB();
      const all = await db.getAll('cachedFiles');
      all.sort((a, b) => {
        if (!a.savedAt && !b.savedAt) return 0;
        if (!a.savedAt) return 1;
        if (!b.savedAt) return -1;
        return b.savedAt.localeCompare(a.savedAt);
      });
      if (all.length <= FILE_CACHE_LIMIT) return false;
      const toDelete = all.slice(FILE_CACHE_LIMIT);
      await Promise.all(toDelete.map(entry => db.delete('cachedFiles', entry.name)));
      return true;
    } catch {
      return false;
    }
  },

  async deleteFileCache(name: string): Promise<void> {
    const db = await getDB();
    await db.delete('cachedFiles', name);
  },

  /**
   * Delete any `savedTexts` entries whose name is not in the provided list.
   * Keeps savedTexts in sync with the records array.
   */
  async pruneTextCacheToRecords(names: string[]): Promise<void> {
    const db = await getDB();
    const keys = await db.getAllKeys('savedTexts');
    const nameSet = new Set(names);
    const toDelete = keys.filter(key => !nameSet.has(key as string));
    await Promise.all(toDelete.map(key => db.delete('savedTexts', key)));
  },

  async saveTextCache(name: string, rawText: string): Promise<void> {
    const db = await getDB();
    await db.put('savedTexts', { name, rawText, savedAt: new Date().toISOString() });
  },

  async getTextCache(name: string): Promise<{ name: string; rawText: string; savedAt: string } | undefined> {
    const db = await getDB();
    return db.get('savedTexts', name);
  },

  async deleteTextCache(name: string): Promise<void> {
    const db = await getDB();
    await db.delete('savedTexts', name);
  },

  async clearTextCache(): Promise<void> {
    const db = await getDB();
    await db.clear('savedTexts');
  },

  /**
   * Check which of the provided names are cached in fileCached or textCached stores.
   * Returns two Sets. On any error, returns empty Sets (graceful degradation to Tier 2).
   */
  async getCachedSessionNames(names: string[]): Promise<{ fileCached: Set<string>; textCached: Set<string> }> {
    try {
      const db = await getDB();
      const results = await Promise.all(
        names.map(async (name) => {
          const [fileKey, textKey] = await Promise.all([
            db.getKey('cachedFiles', name),
            db.getKey('savedTexts', name),
          ]);
          return { name, fileKey, textKey };
        }),
      );
      const fileCached = new Set<string>();
      const textCached = new Set<string>();
      for (const { name, fileKey, textKey } of results) {
        if (fileKey != null) fileCached.add(name);
        if (textKey != null) textCached.add(name);
      }
      return { fileCached, textCached };
    } catch {
      return { fileCached: new Set(), textCached: new Set() };
    }
  },
};
