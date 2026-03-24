/**
 * textUtils.test.ts
 *
 * Unit tests for normalizeText and tokenize utilities.
 */

import { describe, it, expect } from 'vitest';
import { normalizeText, tokenize } from './textUtils';

describe('normalizeText', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('collapses multiple spaces into one', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('collapses mixed whitespace (tabs, newlines) into single space', () => {
    expect(normalizeText('hello\t\nworld')).toBe('hello world');
  });

  it('handles Unicode characters without mangling them', () => {
    const input = 'こんにちは   世界';
    expect(normalizeText(input)).toBe('こんにちは 世界');
  });

  it('handles a string that is only whitespace', () => {
    expect(normalizeText('   \t\n  ')).toBe('');
  });
});

describe('tokenize', () => {
  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('splits on multiple spaces', () => {
    expect(tokenize('hello   world')).toEqual(['hello', 'world']);
  });

  it('filters out punctuation-only tokens', () => {
    // lone dash, pipe, bullet — no \w character
    expect(tokenize('Hello — world | foo • bar')).toEqual(['Hello', 'world', 'foo', 'bar']);
  });

  it('preserves punctuation attached to real words', () => {
    expect(tokenize('Hello, world!')).toEqual(['Hello,', 'world!']);
  });

  it('handles Unicode words', () => {
    expect(tokenize('café résumé naïve')).toEqual(['café', 'résumé', 'naïve']);
  });

  it('returns empty array when input is only whitespace', () => {
    expect(tokenize('   \t\n  ')).toEqual([]);
  });

  it('returns empty array when input is only punctuation tokens', () => {
    expect(tokenize('— | •')).toEqual([]);
  });

  it('strips [Figure] placeholder (case-insensitive)', () => {
    expect(tokenize('hello [Figure] world')).toEqual(['hello', 'world']);
    expect(tokenize('hello [figure] world')).toEqual(['hello', 'world']);
    expect(tokenize('hello [FIGURE] world')).toEqual(['hello', 'world']);
  });

  it('strips TOC dot-leader sequences (4+ dots)', () => {
    expect(tokenize('Chapter 1......... 15')).toEqual(['Chapter', '1', '15']);
    expect(tokenize('Introduction....1')).toEqual(['Introduction', '1']);
  });

  it('preserves three-dot ellipsis (...) in normal prose', () => {
    expect(tokenize('Wait... he said')).toEqual(['Wait...', 'he', 'said']);
    expect(tokenize('I think... therefore I am')).toEqual(['I', 'think...', 'therefore', 'I', 'am']);
  });

  it('preserves version strings and abbreviations with single dots', () => {
    expect(tokenize('v1.3.1 e.g. etc.')).toEqual(['v1.3.1', 'e.g.', 'etc.']);
  });
});
