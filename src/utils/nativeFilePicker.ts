/**
 * nativeFilePicker.ts
 *
 * Utilities for handling files received from native OS integrations
 * (share sheet, "Open with", file associations).
 *
 * No Capacitor imports — this module is safe to import in any environment.
 */

/** Recognised file extensions for supported document formats. */
const SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'epub', 'docx', 'txt', 'md', 'html', 'htm', 'rtf', 'srt',
]);

/** MIME type → file extension map for all supported document types. */
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf':                                                                        'pdf',
  'application/epub+zip':                                                                   'epub',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':               'docx',
  'text/plain':                                                                             'txt',
  'text/markdown':                                                                          'md',
  'text/x-markdown':                                                                        'md',
  'text/html':                                                                              'html',
  'application/rtf':                                                                        'rtf',
  'text/rtf':                                                                               'rtf',
  'application/x-subrip':                                                                   'srt',
  'text/x-subrip':                                                                          'srt',
};

/**
 * Derives a filename from a URI and optional Content-Type header.
 * Exported so `nativeFileReader.ts` can reuse it without duplication.
 *
 * Priority:
 *  1. Last path segment of the URL if it has a recognised extension.
 *  2. MIME-derived extension from Content-Type.
 *  3. Fallback: "document.bin".
 */
export function deriveFilename(url: string, contentType: string | null): string {
  try {
    const decoded = decodeURIComponent(url);
    // Extract the last path segment (ignore query string / fragment)
    const segment = decoded.split('?')[0].split('#')[0].split('/').pop() ?? '';
    if (segment) {
      const dotIndex = segment.lastIndexOf('.');
      if (dotIndex !== -1) {
        const ext = segment.slice(dotIndex + 1).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          return segment;
        }
      }
    }
  } catch {
    // URL decode failed — fall through to MIME-based naming
  }

  if (contentType) {
    // Strip parameters like "; charset=utf-8"
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const ext = MIME_TO_EXT[mime];
    if (ext) {
      return `document.${ext}`;
    }
  }

  return 'document.bin';
}

/**
 * Converts a URL to a File object using the browser's fetch() API.
 *
 * This works for:
 *  - http/https URLs (web builds)
 *  - file:// URLs accessible from the WKWebView sandbox (some iOS builds)
 *
 * It does NOT work for Android content:// URIs from external content providers,
 * which require ContentResolver at the Java layer.  For those, use
 * readNativeFile() in nativeFileReader.ts which uses @capacitor/filesystem.
 *
 * Returns null — never throws — if the URL is empty or the fetch fails.
 *
 * Contains no Capacitor imports and is safe to import in any environment.
 * The isNative() guard lives at the call site.
 */
export async function openFileFromUrl(url: string): Promise<File | null> {
  if (!url) return null;

  let response: Response;
  try {
    response = await fetch(url);
    if (!response.ok) {
      console.warn(`[openFileFromUrl] fetch returned ${response.status} for ${url}`);
      return null;
    }
  } catch (err) {
    console.warn('[openFileFromUrl] fetch failed:', err);
    return null;
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (err) {
    console.warn('[openFileFromUrl] blob conversion failed:', err);
    return null;
  }

  const contentType = response.headers.get('Content-Type');
  const filename = deriveFilename(url, contentType);

  return new File([blob], filename, { type: blob.type || contentType || '' });
}
