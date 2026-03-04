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
  const updated = [record, ...existing].slice(0, MAX_RECORDS);
  localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(updated));
  return updated;
}

/**
 * Delete a reading record by file name.
 * Returns the updated records array.
 */
export function deleteRecord(name: string): ReadingRecord[] {
  const updated = loadRecords().filter((r) => r.name !== name);
  localStorage.setItem(LS_KEY_RECORDS, JSON.stringify(updated));
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
