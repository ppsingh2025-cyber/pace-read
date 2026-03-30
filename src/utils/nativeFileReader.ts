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
 * Why magic bytes detection?
 *  Some Android content:// URIs (e.g. from the Media Documents provider:
 *  content://com.android.providers.media.documents/document/document%3A123) are opaque
 *  — they contain no filename or extension.  deriveFilename() falls back to
 *  "document.bin", which handleFileSelect() rejects as unsupported.  Reading the file
 *  type from the first bytes of the actual content is the only reliable way to
 *  determine the format for those URIs.
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

/** Set of extensions that handleFileSelect() will accept. */
const KNOWN_EXTS = new Set(Object.keys(EXT_TO_MIME));

interface DetectedType { ext: string; mimeType: string }

/**
 * Detects the document type from the first bytes of the file content.
 *
 * Used as a last resort when the URI itself does not expose the filename or
 * extension (e.g. opaque content:// URIs from the Android Media Documents
 * provider).
 *
 * Covers all binary formats supported by PaceRead:
 *  - PDF   — starts with %PDF (25 50 44 46)
 *  - RTF   — starts with {\rtf (7B 5C 72 74 66)
 *  - EPUB  — ZIP with first entry named "mimetype" (required by the EPUB spec)
 *  - DOCX  — any other ZIP (PK magic 50 4B 03 04)
 *
 * Text formats (TXT, MD, HTML, SRT) are not detected here because there is no
 * reliable binary signature; they are identified from the URI or MIME type only.
 */
function detectTypeFromMagicBytes(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 4) return null;

  // PDF: %PDF  (25 50 44 46)
  if (
    bytes[0] === 0x25 && bytes[1] === 0x50 &&
    bytes[2] === 0x44 && bytes[3] === 0x46
  ) {
    return { ext: 'pdf', mimeType: 'application/pdf' };
  }

  // RTF: {\rtf  (7B 5C 72 74 66)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x7B && bytes[1] === 0x5C &&
    bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66
  ) {
    return { ext: 'rtf', mimeType: 'application/rtf' };
  }

  // ZIP-based formats: PK local-file-header magic (50 4B 03 04)
  if (
    bytes[0] === 0x50 && bytes[1] === 0x4B &&
    bytes[2] === 0x03 && bytes[3] === 0x04
  ) {
    // Distinguish EPUB from DOCX.
    // Per the EPUB 3 specification, the first ZIP entry MUST be named "mimetype"
    // (8 bytes) and stored uncompressed.
    //
    // ZIP local-file-header layout (all little-endian):
    //   Offset  Size  Field
    //   0       4     Signature (50 4B 03 04)
    //   4       2     Version needed to extract
    //   6       2     General purpose bit flag
    //   8       2     Compression method
    //   10      2     Last mod file time
    //   12      2     Last mod file date
    //   14      4     CRC-32
    //   18      4     Compressed size
    //   22      4     Uncompressed size
    //   26      2     File name length
    //   28      2     Extra field length
    //   30      n     File name
    if (bytes.length >= 38) {
      const filenameLen = bytes[26] | (bytes[27] << 8);
      if (filenameLen === 8) {
        // Read the 8-byte filename starting at offset 30
        const name = String.fromCharCode(
          bytes[30], bytes[31], bytes[32], bytes[33],
          bytes[34], bytes[35], bytes[36], bytes[37],
        );
        if (name === 'mimetype') {
          return { ext: 'epub', mimeType: 'application/epub+zip' };
        }
      }
    }
    // Any other ZIP-based format: assume DOCX (the only other ZIP-based format
    // registered in the Android intent filters).
    return {
      ext: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  return null;
}

/**
 * Decodes a base64 string to a Uint8Array.
 * Uses atob(), the standard browser / Capacitor WebView API for base64 decoding.
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

    // Derive filename from the URI first (works when the URI encodes a file path).
    let filename = deriveFilename(url, null);
    let ext = filename.split('.').pop()?.toLowerCase() ?? '';
    let mimeType = EXT_TO_MIME[ext] ?? '';

    // If the URI is opaque (no recognizable extension), fall back to magic bytes.
    if (!KNOWN_EXTS.has(ext)) {
      const detected = detectTypeFromMagicBytes(bytes);
      if (detected) {
        ext = detected.ext;
        mimeType = detected.mimeType;
        filename = `document.${ext}`;
      }
    }

    // Use slice() so the File owns exactly the bytes for this view, not any
    // extra padding that might exist in the underlying ArrayBuffer.
    const fileBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new File([fileBuffer], filename, { type: mimeType });
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
