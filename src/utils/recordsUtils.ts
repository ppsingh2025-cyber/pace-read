/**
 * recordsUtils
 *
 * Utilities for persisting and retrieving per-file reading records in
 * localStorage. Records let the app restore a user's previous word position
 * when the same file is re-uploaded.
 */

import type { ReadingRecord } from '../context/readerContextDef';

const LS_KEY_RECORDS = 'fastread_records';
const MAX_RECORDS = 20;

/** Load all saved records (most-recent first). */
export function loadRecords(): ReadingRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY_RECORDS);
    return raw ? (JSON.parse(raw) as ReadingRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Upsert a reading record by file name (most-recent first).
 * Returns the updated records array.
 */
export function saveRecord(record: ReadingRecord): ReadingRecord[] {
  const existing = loadRecords().filter((r) => r.name !== record.name);
  let updated = [record, ...existing].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(updated));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      // Evict the 3 oldest records and retry once
      updated = updated.slice(0, Math.max(1, updated.length - 3));
      try {
        localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(updated));
      } catch {
        // Storage is still full — silently discard to avoid crashing
      }
    }
  }
  return updated;
}

/**
 * Delete a reading record by file name.
 * Returns the updated records array.
 */
export function deleteRecord(name: string): ReadingRecord[] {
  const updated = loadRecords().filter((r) => r.name !== name);
  try {
    localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(updated));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      // Quota hit even while deleting (rare) — retry with further trimming
      const trimmed = updated.slice(0, Math.max(1, updated.length - 3));
      try {
        localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(trimmed));
      } catch {
        // Silently discard
      }
    }
  }
  return updated;
}

/**
 * Delete all reading records.
 * Returns an empty array.
 */
export function clearAllRecords(): ReadingRecord[] {
  localStorage.removeItem(LS_KEY_RECORDS);
  return [];
}
