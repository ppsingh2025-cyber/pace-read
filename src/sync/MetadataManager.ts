/**
 * MetadataManager
 * Unified facade for all metadata operations.
 * Always reads/writes from IndexedDB first (offline-first).
 * Sync to Supabase is triggered separately by SyncService.
 */

import { IndexedDBService } from './IndexedDBService';
import { hashFile } from './fileHasher';
import type { FileMetadata, UserPreferences } from '../types/metadata';

export const MetadataManager = {
  async getOrCreateFileMetadata(file: File): Promise<FileMetadata> {
    // Hash the file to get a stable identifier
    const fileHash = await hashFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const fileType = (ext === 'pdf' || ext === 'epub' ? ext : 'txt') as FileMetadata['fileType'];

    // Check cache first
    const cached = await IndexedDBService.getFileByHash(fileHash);
    if (cached) return cached;

    // Create new metadata
    const meta: FileMetadata = {
      fileHash,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      lastWordIndex: 0,
      lastPage: 0,
      totalPages: 0,
      updatedAt: new Date(),
    };
    await IndexedDBService.saveFileMetadata(meta);
    return meta;
  },

  async updateFileProgress(
    fileHash: string,
    lastWordIndex: number,
    lastPage: number,
    totalPages: number,
  ): Promise<void> {
    const existing = await IndexedDBService.getFileByHash(fileHash);
    if (!existing) return;
    await IndexedDBService.saveFileMetadata({
      ...existing,
      lastWordIndex,
      lastPage,
      totalPages,
      updatedAt: new Date(),
    });
  },

  async savePreferences(prefs: UserPreferences): Promise<void> {
    await IndexedDBService.savePreferences({ ...prefs, updatedAt: new Date() });
  },

  async getPreferences(): Promise<UserPreferences | undefined> {
    return IndexedDBService.getPreferences();
  },
};
