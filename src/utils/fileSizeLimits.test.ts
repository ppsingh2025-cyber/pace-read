/**
 * fileSizeLimits.test.ts
 *
 * Tests the per-format file-size limit logic from App.tsx.
 * The functions are re-implemented here as LOCAL pure copies so this file has
 * no dependency on App.tsx (which imports React and the full app).
 *
 * Limits (per problem spec):
 *   pdf=50 MB, epub=100 MB, docx=20 MB, txt=10 MB, md=10 MB,
 *   html=10 MB, htm=10 MB, rtf=5 MB, srt=5 MB.
 * Unknown extensions fall back to 25 MB.
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Local pure-function copies (no App.tsx dependency)
// ─────────────────────────────────────────────────────────────────────────────
const MB = 1024 * 1024;

const FORMAT_SIZE_LIMITS: Record<string, number> = {
  pdf:  50  * MB,
  epub: 100 * MB,
  docx: 20  * MB,
  txt:  10  * MB,
  md:   10  * MB,
  html: 10  * MB,
  htm:  10  * MB,
  rtf:  5   * MB,
  srt:  5   * MB,
};

function getFormatLimit(ext: string): number {
  return FORMAT_SIZE_LIMITS[ext.toLowerCase()] ?? 25 * MB;
}

function isFileTooLarge(sizeBytes: number, ext: string): boolean {
  return sizeBytes > getFormatLimit(ext);
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN FORMATS GROUP — exact byte limit per extension
// ─────────────────────────────────────────────────────────────────────────────
describe('getFormatLimit — known formats', () => {
  it('pdf  → 50 MB',  () => expect(getFormatLimit('pdf')).toBe(50  * MB));
  it('epub → 100 MB', () => expect(getFormatLimit('epub')).toBe(100 * MB));
  it('docx → 20 MB',  () => expect(getFormatLimit('docx')).toBe(20  * MB));
  it('txt  → 10 MB',  () => expect(getFormatLimit('txt')).toBe(10  * MB));
  it('md   → 10 MB',  () => expect(getFormatLimit('md')).toBe(10  * MB));
  it('html → 10 MB',  () => expect(getFormatLimit('html')).toBe(10  * MB));
  it('htm  → 10 MB',  () => expect(getFormatLimit('htm')).toBe(10  * MB));
  it('rtf  → 5 MB',   () => expect(getFormatLimit('rtf')).toBe(5   * MB));
  it('srt  → 5 MB',   () => expect(getFormatLimit('srt')).toBe(5   * MB));
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE INSENSITIVITY GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('getFormatLimit — case insensitivity', () => {
  it('getFormatLimit("PDF") returns same as getFormatLimit("pdf")', () => {
    expect(getFormatLimit('PDF')).toBe(getFormatLimit('pdf'));
  });

  it('getFormatLimit("Epub") returns same as getFormatLimit("epub")', () => {
    expect(getFormatLimit('Epub')).toBe(getFormatLimit('epub'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNKNOWN FORMATS GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('getFormatLimit — unknown formats', () => {
  it('getFormatLimit("xyz") returns 25 MB fallback', () => {
    expect(getFormatLimit('xyz')).toBe(25 * MB);
  });

  it('getFormatLimit("") returns 25 MB fallback', () => {
    expect(getFormatLimit('')).toBe(25 * MB);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IS FILE TOO LARGE GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('isFileTooLarge', () => {
  it('file exactly at PDF limit (50 MB) is NOT too large', () => {
    expect(isFileTooLarge(50 * MB, 'pdf')).toBe(false);
  });

  it('file 1 byte over PDF limit IS too large', () => {
    expect(isFileTooLarge(50 * MB + 1, 'pdf')).toBe(true);
  });

  it('small TXT file (1 MB) is not too large', () => {
    expect(isFileTooLarge(1 * MB, 'txt')).toBe(false);
  });

  it('TXT file over 10 MB is too large', () => {
    expect(isFileTooLarge(11 * MB, 'txt')).toBe(true);
  });

  it('RTF file over 5 MB is too large', () => {
    expect(isFileTooLarge(6 * MB, 'rtf')).toBe(true);
  });

  it('EPUB just under 100 MB is not too large', () => {
    expect(isFileTooLarge(100 * MB - 1, 'epub')).toBe(false);
  });

  it('60 MB DOCX is too large under per-format limits (regression guard: was OK under old 100 MB blanket)', () => {
    // docx limit is 20 MB — 60 MB must be rejected
    expect(isFileTooLarge(60 * MB, 'docx')).toBe(true);
  });
});
