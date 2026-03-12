/**
 * urlParser.test.ts
 *
 * Tests for src/parsers/urlParser.ts.
 * fetch is mocked globally before the module is imported.
 * vi.useFakeTimers() is used only for the timeout test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fetch before importing the module ────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { parseUrl } = await import('./urlParser');

// ── Helper ────────────────────────────────────────────────────────────────────
function makeHtmlResponse(body: string, status = 200): Response {
  const statusText = status === 200 ? 'OK'
    : status === 404 ? 'Not Found'
    : String(status);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  } as unknown as Response;
}

/** Minimal HTML wrapping a single readable article paragraph */
function articleHtml(text: string): string {
  return `<html><head><title>Test</title></head><body><article>${text}</article></body></html>`;
}

/** A long-enough article text so urlParser doesn't throw "No readable text" */
const ENOUGH_TEXT =
  'The quick brown fox jumps over the lazy dog. '.repeat(10);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// URL VALIDATION GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('parseUrl — URL validation', () => {
  it('rejects a string that is not a URL at all (throws containing "Invalid URL")', async () => {
    await expect(parseUrl('not-a-url-at-all')).rejects.toThrow(/Invalid URL/i);
  });

  it('rejects ftp:// protocol (throws containing "Only http")', async () => {
    await expect(parseUrl('ftp://example.com/file.txt')).rejects.toThrow(/Only http/i);
  });

  it('accepts http:// URL and returns words', async () => {
    mockFetch.mockResolvedValueOnce(makeHtmlResponse(articleHtml(ENOUGH_TEXT)));
    const result = await parseUrl('http://example.com/article');
    expect(result.words.length).toBeGreaterThan(0);
  });

  it('accepts https:// URL and returns words', async () => {
    mockFetch.mockResolvedValueOnce(makeHtmlResponse(articleHtml(ENOUGH_TEXT)));
    const result = await parseUrl('https://example.com/article');
    expect(result.words.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK ERRORS GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('parseUrl — network errors', () => {
  it('throws and includes "404" in message when server returns 404', async () => {
    mockFetch.mockResolvedValueOnce(makeHtmlResponse('', 404));
    await expect(parseUrl('https://example.com/missing')).rejects.toThrow(/404/);
  });

  it('throws and includes "CORS" in message when fetch throws a TypeError', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(parseUrl('https://example.com/cors')).rejects.toThrow(/CORS/i);
  });

  it('throws a "timed out" message when the AbortController fires', async () => {
    vi.useFakeTimers();

    // fetch blocks until the abort signal fires, then rejects with AbortError
    mockFetch.mockImplementation((_url: string, opts: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );

    const promise = parseUrl('https://example.com/slow');
    // Attach a no-op catch immediately so the eventual rejection is never
    // "unhandled" during the async time advance below.
    const caught = promise.catch((e: Error) => e);
    // Advance past the 15 s timeout so controller.abort() fires
    await vi.advanceTimersByTimeAsync(16_000);
    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/timed out/i);

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE EXTRACTION GROUP
// ─────────────────────────────────────────────────────────────────────────────
describe('parseUrl — article extraction', () => {
  it('throws "No readable text" when body is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHtmlResponse('<html><body></body></html>'),
    );
    await expect(parseUrl('https://example.com/empty')).rejects.toThrow(
      /No readable text/i,
    );
  });

  it('the fetch call receives a signal property that is an instance of AbortSignal', async () => {
    let capturedSignal: AbortSignal | undefined;

    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      capturedSignal = opts.signal as AbortSignal | undefined;
      return Promise.resolve(makeHtmlResponse(articleHtml(ENOUGH_TEXT)));
    });

    await parseUrl('https://example.com/signal-check');
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it('extracted words do not include script tag content', async () => {
    const html = `<html><body>
      <article>${ENOUGH_TEXT}</article>
      <script>window.__xss=true</script>
    </body></html>`;

    mockFetch.mockResolvedValueOnce(makeHtmlResponse(html));
    const result = await parseUrl('https://example.com/xss-check');

    const joined = result.words.join(' ');
    expect(joined).not.toContain('__xss');
    expect(joined).not.toContain('window.__xss');
  });
});
