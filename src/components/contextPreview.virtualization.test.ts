/**
 * contextPreview.virtualization.test.ts
 *
 * Tests the pure virtualisation arithmetic that previously lived inside
 * ContextPreview's render IIFE. The functions are extracted here as plain
 * helpers so they can be exercised without React or DOM.
 *
 * NOTE: This test suite deliberately documents known Bug B1 — the broken
 * WORD_ROW_HEIGHT=22 assumption (words are inline spans, not block rows).
 * The virtualisation has since been removed from ContextPreview, but these
 * tests preserve the arithmetic as a regression/documentation record.
 */

import { describe, it, expect } from 'vitest';

// ── Constants mirroring the old ContextPreview implementation ────────────────
const HALF_WIN = 40;
const WORD_ROW_HEIGHT = 22;

// ── Pure helpers extracted from the old render IIFE ─────────────────────────

/**
 * Mirrors the virtual-window IIFE that was inside ContextPreview's content block.
 * Returns the same values the IIFE computed before it was removed.
 */
function computeVirtualWindow(
  pageWords: string[],
  currentWordIndex: number,
  pageStart: number,
) {
  const activeInPage = currentWordIndex - pageStart;
  const renderStart  = Math.max(0, activeInPage - HALF_WIN);
  const renderEnd    = Math.min(pageWords.length, activeInPage + HALF_WIN);
  const visibleWords = pageWords.slice(renderStart, renderEnd);
  const preHeight    = renderStart * WORD_ROW_HEIGHT;
  const postHeight   = (pageWords.length - renderEnd) * WORD_ROW_HEIGHT;
  return { activeInPage, renderStart, renderEnd, visibleWords, preHeight, postHeight };
}

/**
 * Mirrors the inline expression used to map a visible-slot index back to its
 * position in the original (global) words array.
 */
function getGlobalIndex(pageStart: number, renderStart: number, i: number): number {
  return pageStart + renderStart + i;
}

// ── Helper to build a word array of a given length ───────────────────────────
function makeWords(n: number, prefix = 'w'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE BOUNDS GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('computeVirtualWindow — slice bounds', () => {
  it('renders at most HALF_WIN*2 = 80 words when the doc is large', () => {
    const words = makeWords(500);
    const { visibleWords } = computeVirtualWindow(words, 250, 0);
    expect(visibleWords.length).toBeLessThanOrEqual(HALF_WIN * 2);
    expect(visibleWords.length).toBe(80);
  });

  it.each([0, 40, 100, 250, 460, 499])(
    'active word at index %i is always inside the rendered slice (500-word doc)',
    (activeIdx) => {
      const words = makeWords(500);
      const { renderStart, renderEnd, visibleWords } = computeVirtualWindow(words, activeIdx, 0);
      const slotInVisible = activeIdx - renderStart;
      expect(slotInVisible).toBeGreaterThanOrEqual(0);
      expect(slotInVisible).toBeLessThan(visibleWords.length);
      expect(renderEnd).toBeGreaterThan(activeIdx);
      expect(renderStart).toBeLessThanOrEqual(activeIdx);
    },
  );

  it('renderStart never goes below 0 (active word at index 5)', () => {
    const words = makeWords(500);
    const { renderStart } = computeVirtualWindow(words, 5, 0);
    expect(renderStart).toBe(0);
  });

  it('renderEnd never exceeds pageWords.length (active word at index 195 of 200)', () => {
    const words = makeWords(200);
    const { renderEnd } = computeVirtualWindow(words, 195, 0);
    expect(renderEnd).toBe(200);
    expect(renderEnd).toBeLessThanOrEqual(words.length);
  });

  it('all words rendered when document is shorter than the window (30 words, active at 15)', () => {
    const words = makeWords(30);
    const { renderStart, renderEnd, visibleWords } = computeVirtualWindow(words, 15, 0);
    expect(renderStart).toBe(0);
    expect(renderEnd).toBe(30);
    expect(visibleWords).toEqual(words);
  });

  it('visibleWords is exactly pageWords.slice(renderStart, renderEnd)', () => {
    const words = makeWords(500);
    const { renderStart, renderEnd, visibleWords } = computeVirtualWindow(words, 250, 0);
    expect(visibleWords).toEqual(words.slice(renderStart, renderEnd));
  });

  it('renderStart is 0 when activeInPage === HALF_WIN exactly', () => {
    const words = makeWords(500);
    // pageStart=0, currentWordIndex=HALF_WIN → activeInPage === HALF_WIN
    const { renderStart } = computeVirtualWindow(words, HALF_WIN, 0);
    expect(renderStart).toBe(0);
  });

  it('renderStart is 1 when activeInPage === HALF_WIN + 1', () => {
    const words = makeWords(500);
    const { renderStart } = computeVirtualWindow(words, HALF_WIN + 1, 0);
    expect(renderStart).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL INDEX GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('getGlobalIndex — mapping visible slot back to original position', () => {
  it('globalIndex of visibleWords[0] equals pageStart + renderStart', () => {
    const words = makeWords(500);
    const { renderStart } = computeVirtualWindow(words, 250, 0);
    expect(getGlobalIndex(0, renderStart, 0)).toBe(0 + renderStart);
  });

  it('for every i in visibleWords, words[getGlobalIndex] === visibleWords[i] (pageStart=0)', () => {
    const words = makeWords(500);
    const { renderStart, visibleWords } = computeVirtualWindow(words, 250, 0);
    for (let i = 0; i < visibleWords.length; i++) {
      expect(words[getGlobalIndex(0, renderStart, i)]).toBe(visibleWords[i]);
    }
  });

  it('globalIndex of the active visible slot equals currentWordIndex (pageStart=50, cwi=150, 200 words)', () => {
    const pageStart = 50;
    const currentWordIndex = 150;
    const pageWords = makeWords(200);
    const { renderStart, activeInPage } = computeVirtualWindow(pageWords, currentWordIndex, pageStart);
    // The active element sits at (activeInPage - renderStart) within visibleWords
    const activeSlotI = activeInPage - renderStart;
    expect(getGlobalIndex(pageStart, renderStart, activeSlotI)).toBe(currentWordIndex);
  });

  it('globalIndex is correct with a non-zero pageStart of 500', () => {
    const pageStart = 500;
    const currentWordIndex = 600;
    const pageWords = makeWords(200);
    const { renderStart } = computeVirtualWindow(pageWords, currentWordIndex, pageStart);
    // First visible slot maps to pageStart + renderStart
    expect(getGlobalIndex(pageStart, renderStart, 0)).toBe(pageStart + renderStart);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PREHEIGHT / POSTHEIGHT GROUP — documents Bug B1
// ─────────────────────────────────────────────────────────────────────────────
describe('preHeight / postHeight — arithmetic and Bug B1 documentation', () => {
  it('preHeight equals renderStart * WORD_ROW_HEIGHT', () => {
    const words = makeWords(500);
    const { renderStart, preHeight } = computeVirtualWindow(words, 250, 0);
    expect(preHeight).toBe(renderStart * WORD_ROW_HEIGHT);
  });

  it('postHeight equals (pageWords.length - renderEnd) * WORD_ROW_HEIGHT', () => {
    const words = makeWords(500);
    const { renderEnd, postHeight } = computeVirtualWindow(words, 250, 0);
    expect(postHeight).toBe((words.length - renderEnd) * WORD_ROW_HEIGHT);
  });

  it('BUG B1: for 1000 words with active at 500, preHeight > 5× approximate real layout height', () => {
    const words = makeWords(1000);
    const { renderStart, preHeight } = computeVirtualWindow(words, 500, 0);
    // Words are inline spans — ~10 words fit per line, not 1.
    // Approximate real scrolled height = (renderStart / 10) * WORD_ROW_HEIGHT
    const approxRealHeight = (renderStart / 10) * WORD_ROW_HEIGHT;
    // The old padding is more than 5× the real height → wrong scroll position
    expect(preHeight).toBeGreaterThan(approxRealHeight * 5);
  });

  it('preHeight + postHeight accounts for exactly the words outside the rendered window', () => {
    const words = makeWords(500);
    const { renderStart, renderEnd, preHeight, postHeight } = computeVirtualWindow(words, 250, 0);
    const wordsOutsideWindow = renderStart + (words.length - renderEnd);
    expect((preHeight + postHeight) / WORD_ROW_HEIGHT).toBe(wordsOutsideWindow);
  });

  it('single-word document: preHeight=0, postHeight=0', () => {
    const words = makeWords(1);
    const { preHeight, postHeight } = computeVirtualWindow(words, 0, 0);
    expect(preHeight).toBe(0);
    expect(postHeight).toBe(0);
  });

  it('empty pageWords: all outputs are 0 or empty', () => {
    const { activeInPage, renderStart, renderEnd, visibleWords, preHeight, postHeight } =
      computeVirtualWindow([], 0, 0);
    expect(activeInPage).toBe(0);
    expect(renderStart).toBe(0);
    expect(renderEnd).toBe(0);
    expect(visibleWords).toEqual([]);
    expect(preHeight).toBe(0);
    expect(postHeight).toBe(0);
  });
});
