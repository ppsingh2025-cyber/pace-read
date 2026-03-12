/**
 * readerContext.debounce.test.ts
 *
 * Tests the debounce logic that throttles localStorage writes in ReaderContext.
 * The actual context is NOT imported or rendered — instead we implement a minimal
 * reproduction of the debounce logic as createDebouncedIndexWriter() and exercise
 * it with vi.useFakeTimers().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Constants ────────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 500;
const LS_KEY = 'fastread_word_index';

// ── Minimal debounce factory ──────────────────────────────────────────────────
/**
 * Reproduces the word-index debounce behaviour of ReaderContext:
 *  - pendingIndexRef always holds the latest value
 *  - timerRef tracks the active setTimeout handle
 *  - write(index) cancels any pending timer and schedules a new one
 *  - flush() writes immediately and cancels any pending timer
 */
function createDebouncedIndexWriter(ls: { setItem: (key: string, value: string) => void }) {
  let pendingIndex = 0;
  let timerRef: ReturnType<typeof setTimeout> | null = null;

  function write(index: number): void {
    pendingIndex = index;
    if (timerRef !== null) {
      clearTimeout(timerRef);
    }
    timerRef = setTimeout(() => {
      ls.setItem(LS_KEY, String(pendingIndex));
      timerRef = null;
    }, DEBOUNCE_MS);
  }

  function flush(): void {
    if (timerRef !== null) {
      clearTimeout(timerRef);
      timerRef = null;
      ls.setItem(LS_KEY, String(pendingIndex));
    }
  }

  return { write, flush };
}

// ── localStorage mock (reset in beforeEach) ──────────────────────────────────
let setItemMock: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;

beforeEach(() => {
  vi.useFakeTimers();
  setItemMock = vi.fn<(key: string, value: string) => void>();
  vi.stubGlobal('localStorage', { setItem: setItemMock });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// WRITE TIMING GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('createDebouncedIndexWriter — write timing', () => {
  it('does NOT write to localStorage immediately when index changes', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(42);
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it('writes exactly once after 500 ms with no further changes', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(7);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setItemMock).toHaveBeenCalledTimes(1);
  });

  it('written value is the correct index that was passed', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(123);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setItemMock).toHaveBeenCalledWith(LS_KEY, '123');
  });

  it('cancels pending write when a new change arrives within the 500 ms window', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(1);                         // t=0
    vi.advanceTimersByTime(200);
    writer.write(2);                         // t=200 — resets timer
    vi.advanceTimersByTime(200);
    writer.write(3);                         // t=400 — resets timer again
    // At t=400 ms: less than 500 ms since last write — nothing written yet
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it('after 25 rapid changes at 40 ms intervals, only 1 write occurs after debounce settles', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    for (let i = 0; i < 25; i++) {
      writer.write(i);
      vi.advanceTimersByTime(40); // each step = 40 ms, timer kept getting reset
    }
    // After 25 × 40 ms = 1000 ms the last timer fires 500 ms after the 25th write (t=960+500=1460)
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setItemMock).toHaveBeenCalledTimes(1);
  });

  it('that final write contains the value of the 25th change (not the first)', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    for (let i = 0; i < 25; i++) {
      writer.write(i);
      vi.advanceTimersByTime(40);
    }
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setItemMock).toHaveBeenCalledWith(LS_KEY, '24');
  });

  it('write count divided by total changes is less than 0.1 (>90 % reduction)', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    const TOTAL = 25;
    for (let i = 0; i < TOTAL; i++) {
      writer.write(i);
      vi.advanceTimersByTime(40);
    }
    vi.advanceTimersByTime(DEBOUNCE_MS);
    const ratio = setItemMock.mock.calls.length / TOTAL;
    expect(ratio).toBeLessThan(0.1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUSH GROUP — simulates tab close and component unmount
// ─────────────────────────────────────────────────────────────────────────────
describe('createDebouncedIndexWriter — flush', () => {
  it('flush() writes the latest pending value immediately without waiting for the timer', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(42);
    // Flush before the debounce fires
    writer.flush();
    expect(setItemMock).toHaveBeenCalledTimes(1);
    expect(setItemMock).toHaveBeenCalledWith(LS_KEY, '42');
  });

  it('flush() cancels the pending timer so no duplicate write happens after flush', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(99);
    writer.flush();
    expect(setItemMock).toHaveBeenCalledTimes(1);
    // Advance well past the debounce window — timer must have been cancelled
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setItemMock).toHaveBeenCalledTimes(1); // still only 1
  });

  it('after flush(), advancing timers by 2× debounce period causes no additional writes', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    writer.write(55);
    writer.flush();
    vi.advanceTimersByTime(DEBOUNCE_MS * 2);
    expect(setItemMock).toHaveBeenCalledTimes(1);
  });

  it('flush() when no pending write exists does not throw', () => {
    const writer = createDebouncedIndexWriter({ setItem: setItemMock });
    // Never called write() — no pending timer
    expect(() => writer.flush()).not.toThrow();
  });
});
