/**
 * IndexedDBService
 * Local metadata storage using IndexedDB via the 'idb' library.
 * Acts as the offline-first source of truth for all metadata.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { FileMetadata, UserPreferences, ReadingSession } from '../types/metadata';

const DB_NAME = 'readswift_metadata';
const DB_VERSION = 1;

interface ReadSwiftDB {
  files: FileMetadata & { id: string };
  preferences: UserPreferences & { id: string };
  sessions: ReadingSession & { id: string };
  syncState: { key: string; value: string | number };
}

let dbInstance: IDBPDatabase<ReadSwiftDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ReadSwiftDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ReadSwiftDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
};
