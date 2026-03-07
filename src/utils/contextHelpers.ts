export const PREVIEW_WORDS_BEFORE = 4;
export const PREVIEW_WORDS_AFTER  = 10;
export const CONTEXT_WORDS_BEFORE = 20;
export const CONTEXT_WORDS_AFTER  = 30;

export const getContextPreview = (words: string[], idx: number) =>
  words.slice(Math.max(0, idx - PREVIEW_WORDS_BEFORE), Math.min(words.length, idx + PREVIEW_WORDS_AFTER)).join(' ');

export type ContextSegment = { text: string; isCurrent: boolean };
export const getContextSegments = (words: string[], idx: number): ContextSegment[] => {
  const start = Math.max(0, idx - CONTEXT_WORDS_BEFORE), end = Math.min(words.length, idx + CONTEXT_WORDS_AFTER);
  return words.slice(start, end).map((w, i) => ({ text: w, isCurrent: start + i === idx }));
};
