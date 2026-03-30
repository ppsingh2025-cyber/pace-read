/**
 * nativeFileReader.ts
 *
 * Reads a file delivered by the native OS (Android "Open with" / iOS share sheet)
 * from a content:// or file:// URI and returns a File object.
 *
 * Strategy:
 *  1. Primary   — @capacitor/filesystem Filesystem.readFile()
 *                 Android: uses ContentResolver.openInputStream() — works for
 *                 content:// URIs with URI-permission grants from VIEW intents.
 *                 iOS: uses FileManager — works for file:// paths in the app sandbox.
 *  2. Fallback  — fetch() for edge cases (e.g. publicly accessible http/https URLs,
 *                 or iOS environments where WKWebView can read file:// directly).
 *
 * Why NOT fetch() as primary?
 *  fetch('content://...') in Capacitor's WebView JavaScript sandbox cannot read
 *  content:// URIs from external content providers (Downloads, Drive, Files app, etc.)
 *  because these require the Android ContentResolver Java API.  The Activity receives
 *  FLAG_GRANT_READ_URI_PERMISSION via the intent, but that Java-layer permission is
 *  not forwarded to the JS fetch() call.
 *
 * This module imports from @capacitor/filesystem and must only be called from
 * native contexts (always guarded by isNative() at the call site).
 */

import { Filesystem } from '@capacitor/filesystem';
import { deriveFilename } from './nativeFilePicker';

/** Extension → MIME type for all document formats handled by the app. */
const EXT_TO_MIME: Record<string, string> = {
  pdf:  'application/pdf',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:  'text/plain',
  md:   'text/markdown',
  html: 'text/html',
  htm:  'text/html',
  rtf:  'application/rtf',
  srt:  'application/x-subrip',
};

/**
 * Decodes a base64 string to a Uint8Array without using deprecated atob workarounds.
 * Works in both browser and Capacitor WebView environments.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Reads a native URI (content:// or file://) delivered by the OS and returns a
 * File object suitable for passing directly to handleFileSelect().
 *
 * Returns null — never throws — if the URI cannot be read by either strategy.
 *
 * Must be called only on native (always guarded by isNative() at the call site).
 */
export async function readNativeFile(url: string): Promise<File | null> {
  if (!url) return null;

  // --- Strategy 1: Capacitor Filesystem plugin (native ContentResolver / FileManager) ---
  try {
    const result = await Filesystem.readFile({ path: url });

    let bytes: Uint8Array;
    if (typeof result.data === 'string') {
      // Capacitor returns base64 for binary files when no encoding is specified.
      bytes = base64ToBytes(result.data);
    } else {
      // Newer Capacitor builds may return a Blob directly.
      bytes = new Uint8Array(await (result.data as Blob).arrayBuffer());
    }

    const filename = deriveFilename(url, null);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = EXT_TO_MIME[ext] ?? '';

    return new File([bytes.buffer as ArrayBuffer], filename, { type: mimeType });
  } catch (primaryErr) {
    console.warn('[readNativeFile] Filesystem plugin failed, trying fetch fallback:', primaryErr);
  }

  // --- Strategy 2: fetch() fallback (handles http/https and some file:// on iOS) ---
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[readNativeFile] fetch fallback returned ${response.status} for ${url}`);
      return null;
    }
    const blob = await response.blob();
    const contentType = response.headers.get('Content-Type');
    const filename = deriveFilename(url, contentType);
    return new File([blob], filename, { type: blob.type || contentType || '' });
  } catch (fallbackErr) {
    console.warn('[readNativeFile] fetch fallback also failed:', fallbackErr);
    return null;
  }
}
