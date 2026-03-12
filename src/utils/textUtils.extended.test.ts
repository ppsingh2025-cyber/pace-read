/**
 * textUtils.extended.test.ts
 *
 * Edge-case coverage on top of the existing textUtils.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { normalizeText, tokenize } from './textUtils';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZETEXT EXTENDED GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeText — extended edge cases', () => {
  it('non-breaking space \\u00a0 alone collapses to empty string (\\s+ matches \\u00a0 in JS)', () => {
    // ECMAScript \s includes U+00A0; replace(/\s+/, ' ').trim() → ''
    expect(normalizeText('\u00a0')).toBe('');
  });

  it('"hello\\u00a0world" normalises to "hello world"', () => {
    expect(normalizeText('hello\u00a0world')).toBe('hello world');
  });

  it('Windows CRLF (\\r\\n) collapses to a single space', () => {
    expect(normalizeText('hello\r\nworld')).toBe('hello world');
  });

  it('mixed \\r and \\n collapse to single spaces', () => {
    expect(normalizeText('a\rb\nc')).toBe('a b c');
  });

  it('very long string of 10,000 words separated by various whitespace roundtrips correctly', () => {
    const words = Array.from({ length: 10_000 }, (_, i) => `word${i}`);
    const raw = words.join('\t '); // mixed whitespace between each word
    const result = normalizeText(raw);
    const resultWords = result.split(' ');
    expect(resultWords).toHaveLength(10_000);
    expect(resultWords[0]).toBe('word0');
    expect(resultWords[9999]).toBe('word9999');
  });

  it('already-normalised string is returned unchanged', () => {
    const clean = 'this is already clean text';
    expect(normalizeText(clean)).toBe(clean);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TOKENIZE EXTENDED GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('tokenize — extended edge cases', () => {
  it('hyphenated compound word "state-of-the-art" is kept as one token', () => {
    const tokens = tokenize('state-of-the-art');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toBe('state-of-the-art');
  });

  it('numbers are valid tokens ("chapter 1 verse 2")', () => {
    const tokens = tokenize('chapter 1 verse 2');
    expect(tokens).toContain('1');
    expect(tokens).toContain('2');
  });

  it('contractions "don\'t won\'t can\'t" are single tokens each', () => {
    const tokens = tokenize("don't won't can't");
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toBe("don't");
    expect(tokens[1]).toBe("won't");
    expect(tokens[2]).toBe("can't");
  });

  it('string of only dashes "--- --- ---" returns empty array', () => {
    expect(tokenize('--- --- ---')).toEqual([]);
  });

  it('very long word (1000 chars) is returned as a single token without error', () => {
    const longWord = 'a'.repeat(1000);
    const tokens = tokenize(longWord);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toHaveLength(1000);
  });

  it('tokenize output is identical whether called on raw input or normalizeText(raw) input', () => {
    const raw = 'hello   world\t  foo\n  bar';
    expect(tokenize(raw)).toEqual(tokenize(normalizeText(raw)));
  });

  it('no token in the output is an empty string', () => {
    const tokens = tokenize('  hello   world  ');
    expect(tokens.every((t) => t.length > 0)).toBe(true);
  });

  it('no token in the output is whitespace-only', () => {
    const tokens = tokenize('alpha   beta\tgamma\ndelta');
    expect(tokens.every((t) => t.trim().length > 0)).toBe(true);
  });
});
