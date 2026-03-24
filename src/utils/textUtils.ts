/**
 * textUtils
 *
 * Shared text-processing utilities:
 * - normalizeText: collapse whitespace, trim
 * - tokenize: split a text block into words via regex, filtering empty tokens
 */

/** Normalize whitespace in a string */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Split text into an array of words, stripping punctuation-only tokens that
 * add no reading value (e.g. lone hyphens or pipes) while preserving
 * punctuation attached to real words.
 *
 * Pre-processing steps applied before splitting:
 * - `[Figure]` placeholders (emitted by the PDF parser for diagram zones) are
 *   replaced with a space so they never surface as RSVP words.
 * - TOC dot-leader sequences of 4+ consecutive dots (e.g. `Chapter 1.........15`)
 *   are replaced with a space.  The threshold of 4 is intentional: it preserves
 *   three-dot ellipsis (`...`) used in normal prose while eliminating dot-leaders.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/\[Figure\]/gi, ' ')  // strip diagram placeholders before splitting
    .replace(/\.{4,}/g, ' ')        // strip TOC dot-leader sequences (4+ consecutive dots)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && /\w/.test(w));
}
