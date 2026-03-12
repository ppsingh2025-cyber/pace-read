/**
 * recordsUtils.test.ts
 *
 * Unit tests for saveRecord, loadRecords, deleteRecord, and the
 * QuotaExceededError eviction-retry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReadingRecord } from '../context/readerContextDef';

// ── localStorage mock ────────────────────────────────────────────────────────
// We use a plain Map to back the mock so we can simulate QuotaExceededError.
let store: Map<string, string>;
let quotaMode = false; // when true, setItem throws QuotaExceededError

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (quotaMode) {
      const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
      throw err;
    }
    store.set(key, value);
  },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() { return store.size; },
};

vi.stubGlobal('localStorage', localStorageMock);

// Import after stubbing so the module sees the mocked localStorage
const { saveRecord, loadRecords, deleteRecord } = await import('./recordsUtils');

// ── helpers ──────────────────────────────────────────────────────────────────
function makeRecord(name: string, index = 0): ReadingRecord {
  return {
    name,
    wordCount: 1000,
    lastWordIndex: index,
    lastReadAt: new Date().toISOString(),
    wpm: 250,
  };
}

beforeEach(() => {
  store = new Map();
  quotaMode = false;
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('saveRecord / loadRecords roundtrip', () => {
  it('saves a record and loads it back', () => {
    const rec = makeRecord('test.pdf', 42);
    saveRecord(rec);
    const loaded = loadRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('test.pdf');
    expect(loaded[0].lastWordIndex).toBe(42);
  });

  it('upserts an existing record (same name)', () => {
    saveRecord(makeRecord('book.epub', 10));
    saveRecord(makeRecord('book.epub', 99));
    const loaded = loadRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].lastWordIndex).toBe(99);
  });

  it('most-recent record appears first', () => {
    saveRecord(makeRecord('first.txt', 1));
    saveRecord(makeRecord('second.txt', 2));
    const loaded = loadRecords();
    expect(loaded[0].name).toBe('second.txt');
    expect(loaded[1].name).toBe('first.txt');
  });
});

describe('MAX_RECORDS cap (20 entries)', () => {
  it('never stores more than 20 records', () => {
    for (let i = 0; i < 25; i++) {
      saveRecord(makeRecord(`file-${i}.txt`, i));
    }
    const loaded = loadRecords();
    expect(loaded.length).toBeLessThanOrEqual(20);
  });

  it('keeps the most-recent 20', () => {
    for (let i = 0; i < 25; i++) {
      saveRecord(makeRecord(`file-${i}.txt`, i));
    }
    const loaded = loadRecords();
    // The most-recently saved should be file-24
    expect(loaded[0].name).toBe('file-24.txt');
  });
});

describe('deleteRecord', () => {
  it('removes a record by name', () => {
    saveRecord(makeRecord('a.pdf'));
    saveRecord(makeRecord('b.pdf'));
    deleteRecord('a.pdf');
    const loaded = loadRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('b.pdf');
  });

  it('is a no-op when the name does not exist', () => {
    saveRecord(makeRecord('a.pdf'));
    deleteRecord('nonexistent.pdf');
    expect(loadRecords()).toHaveLength(1);
  });
});

describe('QuotaExceededError eviction retry in saveRecord', () => {
  it('trims oldest 3 records and retries when quota is exceeded', () => {
    // Pre-populate 5 records normally
    for (let i = 0; i < 5; i++) {
      saveRecord(makeRecord(`file-${i}.pdf`, i));
    }
    expect(loadRecords()).toHaveLength(5);

    // Now simulate quota exceeded on the next setItem
    quotaMode = true;
    // After quota error, the mock falls back to the store as-is
    // We must allow the retry to succeed — toggle off after first throw
    let firstThrow = true;
    localStorageMock.setItem = (key: string, value: string) => {
      if (quotaMode && firstThrow) {
        firstThrow = false;
        const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw err;
      }
      store.set(key, value);
    };

    // Save a new record — should trigger eviction + retry
    const result = saveRecord(makeRecord('new.pdf', 0));
    // Should have trimmed and saved without throwing
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.name === 'new.pdf')).toBe(true);
  });
});
