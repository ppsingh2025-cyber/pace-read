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
 *
 * Priority:
 *  1. Last path segment of the URL if it has a recognised extension.
 *  2. MIME-derived extension from Content-Type.
 *  3. Fallback: "document.bin".
 */
function deriveFilename(url: string, contentType: string | null): string {
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
 * Converts a file URI (file:// or content://) to a File object.
 *
 * Used when the OS delivers a file-open intent or share-sheet event to the app.
 * The Capacitor WebView on both Android and iOS allows fetch() to read file://
 * and content:// URIs from the host process.
 *
 * Returns null if the fetch fails or the URL is empty.
 *
 * This function contains no Capacitor imports and is safe to import anywhere.
 * The isNative() guard lives at the call site (App.tsx).
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
