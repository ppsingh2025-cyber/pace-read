/**
 * urlParser
 *
 * Fetches an article URL and extracts clean, readable text.
 *
 * Strategy:
 *   1. Attempt a direct fetch (works for CORS-open URLs).
 *   2. Parse returned HTML with DOMParser.
 *   3. Strip boilerplate (nav, header, footer, aside, script, style).
 *   4. Extract the largest contiguous block of text, which is typically the
 *      article body (a simple Readability-style heuristic without the library).
 *
 * Fails gracefully: any network or CORS error returns a descriptive message
 * so the caller can surface it to the user instead of crashing.
 */

import { parseRawText, type ParsedText } from './textParser';

/** Score a DOM element by the density of its readable text content */
function scoreElement(el: Element): number {
  const text = el.textContent ?? '';
  // Prefer elements with longer text and fewer links (nav-heavy blocks score low)
  const links = el.querySelectorAll('a').length;
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  // Penalize elements whose text is mostly inside links
  return words - links * 2;
}

/**
 * Extract readable article text from a parsed HTML Document.
 * Strips non-content elements then picks the highest-scoring container.
 */
function extractArticleText(doc: Document): string {
  // Remove boilerplate elements
  const boilerplate = [
    'script', 'style', 'noscript', 'nav', 'header', 'footer',
    'aside', 'form', 'figure', 'figcaption', 'iframe', 'button',
    'select', 'input', 'textarea',
  ];
  boilerplate.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Common article container candidates
  const candidates = [
    ...Array.from(doc.querySelectorAll('article, main, [role="main"]')),
    // Fallback: any div / section with a meaningful amount of text
    ...Array.from(doc.querySelectorAll('div, section, p')).filter((el) => {
      const words = (el.textContent ?? '').split(/\s+/).length;
      return words > 50;
    }),
  ];

  if (candidates.length === 0) {
    // Last resort: entire body
    return doc.body?.textContent ?? '';
  }

  // Pick highest-scoring candidate
  let best = candidates[0];
  let bestScore = scoreElement(best);
  for (const el of candidates) {
    const score = scoreElement(el);
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best.textContent ?? '';
}

/**
 * Fetch the article at `url`, extract readable text, and return a ParsedText
 * object ready for the reading engine.
 *
 * Throws a human-readable error string on failure (CORS, network, etc.).
 */
export async function parseUrl(url: string): Promise<ParsedText> {
  // Basic URL validation before attempting a fetch
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL. Please enter a full URL starting with https://');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  let html: string;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000); // 15 s timeout
  try {
    const response = await fetch(url, {
      // no-cors mode would only give an opaque response; we need the text body
      mode: 'cors',
      headers: { Accept: 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }
    html = await response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Request timed out after 15 seconds. The site may be slow or blocking requests.',
      );
    }
    // CORS errors are reported as generic TypeError in the browser
    if (err instanceof TypeError) {
      throw new Error(
        'Could not fetch the URL — the site may block cross-origin requests (CORS). ' +
          'Try copying and pasting the article text directly instead.',
      );
    }
    throw err;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.title?.trim() ?? undefined;
  const articleText = extractArticleText(doc);

  if (!articleText.trim()) {
    throw new Error('No readable text could be extracted from that URL.');
  }

  const result = parseRawText(articleText, 'url');
  return {
    ...result,
    metadata: { ...result.metadata, title, format: 'url' },
  };
}
