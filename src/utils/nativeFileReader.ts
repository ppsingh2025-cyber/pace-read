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
 * Why content sniffing?
 *  Some Android content:// URIs (e.g. from Google Drive, Dropbox, or the Media
 *  Documents provider) are opaque — they contain no filename or extension.
 *  deriveFilename() falls back to "document.bin", which handleFileSelect() rejects
 *  as unsupported.  Reading the file type from the actual content bytes is the
 *  only reliable way to determine the format for those URIs.
 *
 *  Two-phase detection is used:
 *   Phase 1 — Binary magic bytes: fast check of the first 4–5 bytes for well-known
 *              binary signatures (PDF, RTF, ZIP-based).
 *   Phase 2 — Text content sniff: UTF-8 decode of the first kilobyte to detect
 *              HTML, SRT, and generic plain text (covers MD and TXT).
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
 * Number of bytes to scan for EPUB directory markers (META-INF / OEBPS).
 * 256 bytes covers at least two ZIP local-file-header records, which is enough
 * to see the first one or two entries in any well-formed EPUB archive.
 */
const EPUB_SCAN_LENGTH = 256;

/**
 * Number of bytes to sample when testing whether content is binary.
 * 512 bytes provides a statistically reliable sample for the binary-guard
 * heuristic without reading a large chunk of the file unnecessarily.
 */
const BINARY_SAMPLE_SIZE = 512;

/**
 * Maximum proportion of non-text bytes (null / control chars) allowed before
 * a file is classified as binary.  10% was chosen empirically: genuine text
 * files rarely exceed 1–2%, while binary files typically exceed 20–30%.
 */
const BINARY_BYTE_THRESHOLD = 0.10;

/**
 * Number of bytes to decode as UTF-8 for text-pattern matching.
 * 1024 bytes is enough to see the opening tag or first subtitle cue of any
 * HTML or SRT document without consuming excessive memory.
 */
const TEXT_SNIPPET_SIZE = 1024;

// ─── Phase 1: Binary magic bytes ─────────────────────────────────────────────

/**
 * Detects binary document types from the first bytes of the file content.
 *
 * Covers all binary formats supported by PaceRead:
 *  - PDF   — starts with %PDF (25 50 44 46)
 *  - RTF   — starts with {\rtf (7B 5C 72 74 66)
 *  - EPUB  — ZIP archive whose first entry is named "mimetype", OR whose content
 *            within the first 256 bytes contains the EPUB-specific directory
 *            entries "META-INF" or "OEBPS" (handles non-spec-compliant EPUBs
 *            where "mimetype" is not the very first ZIP entry)
 *  - DOCX  — any other ZIP (PK magic 50 4B 03 04)
 */
function detectTypeFromBinaryMagic(bytes: Uint8Array): DetectedType | null {
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
    //
    // Primary check — Per the EPUB 3 specification the first ZIP entry MUST be
    // a file named exactly "mimetype" (8 bytes) stored uncompressed.
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
        const name = String.fromCharCode(
          bytes[30], bytes[31], bytes[32], bytes[33],
          bytes[34], bytes[35], bytes[36], bytes[37],
        );
        if (name === 'mimetype') {
          return { ext: 'epub', mimeType: 'application/epub+zip' };
        }
      }
    }

    // Fallback EPUB check — scan the first 256 bytes for the characteristic EPUB
    // directory names.  Non-compliant EPUBs (first entry is not "mimetype") still
    // reliably contain "META-INF/container.xml" and/or "OEBPS/" entries.
    // This is a plain ASCII substring search; no charset conversion needed.
    const scanLen = Math.min(bytes.length, EPUB_SCAN_LENGTH);
    let epubMarkerFound = false;
    for (let i = 0; i <= scanLen - 8; i++) {
      // "META-INF" (4D 45 54 41 2D 49 4E 46)
      if (
        bytes[i] === 0x4D && bytes[i+1] === 0x45 && bytes[i+2] === 0x54 &&
        bytes[i+3] === 0x41 && bytes[i+4] === 0x2D && bytes[i+5] === 0x49 &&
        bytes[i+6] === 0x4E && bytes[i+7] === 0x46
      ) { epubMarkerFound = true; break; }
      // "OEBPS" (4F 45 42 50 53) — 5 bytes
      if (
        i <= scanLen - 5 &&
        bytes[i] === 0x4F && bytes[i+1] === 0x45 && bytes[i+2] === 0x42 &&
        bytes[i+3] === 0x50 && bytes[i+4] === 0x53
      ) { epubMarkerFound = true; break; }
    }
    if (epubMarkerFound) {
      return { ext: 'epub', mimeType: 'application/epub+zip' };
    }

    // Any other ZIP-based format: assume DOCX (the only remaining ZIP-based
    // format registered in the Android intent filters).
    return {
      ext: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  return null;
}

// ─── Phase 2: Text content sniff ─────────────────────────────────────────────

/**
 * Detects text-based document types by decoding the first kilobyte as UTF-8
 * and matching well-known content patterns.
 *
 * Called only when binary magic bytes detection returns null (i.e. the file is
 * not PDF, RTF, EPUB or DOCX).  Handles the remaining supported text formats:
 *  - HTML  — document starts with <!DOCTYPE html, <html, <?xml, or <head
 *  - SRT   — first non-empty lines follow the subtitle block pattern
 *  - TXT   — any other content that is valid UTF-8 text (covers MD, plain TXT,
 *            and any other text-based format — MD is indistinguishable from TXT
 *            at the byte level and parses correctly through the TXT path)
 *
 * Returns null if the first 512 bytes indicate binary content (too many control
 * or null characters), preventing binary files from being misidentified as text.
 */
function detectTypeFromTextContent(bytes: Uint8Array): DetectedType | null {
  // Binary guard: if more than 10% of the first 512 bytes are null bytes or
  // non-printable control characters (outside \t, \n, \r), treat as binary.
  const sampleLen = Math.min(bytes.length, BINARY_SAMPLE_SIZE);
  let binaryCount = 0;
  for (let i = 0; i < sampleLen; i++) {
    const b = bytes[i];
    if (b === 0x00 || (b < 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D)) {
      binaryCount++;
    }
  }
  if (binaryCount / sampleLen > BINARY_BYTE_THRESHOLD) return null;

  // Decode up to the first 1024 bytes as UTF-8 (lossy — replacement chars for
  // invalid sequences won't affect the ASCII-range pattern matching below).
  const snippet = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, Math.min(bytes.length, TEXT_SNIPPET_SIZE)));
  const trimmed = snippet.trimStart();

  // HTML: starts with a recognised HTML/XML declaration or root element.
  if (
    /^<!DOCTYPE\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /^<head[\s>]/i.test(trimmed) ||
    /^<\?xml\s/i.test(trimmed)
  ) {
    return { ext: 'html', mimeType: 'text/html' };
  }

  // SRT: first two non-empty lines match the subtitle block pattern:
  //   line 1 — a plain integer (the cue index)
  //   line 2 — a timecode like "00:00:00,000 --> 00:00:02,500"
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (
    lines.length >= 2 &&
    /^\d+$/.test(lines[0]) &&
    /^\d{2}:\d{2}:\d{2}[,.:]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.:]\d{3}/.test(lines[1])
  ) {
    return { ext: 'srt', mimeType: 'application/x-subrip' };
  }

  // Generic plain text — covers TXT, MD, and any other text-based format.
  // MD loaded as TXT is functional: the reader displays all text including
  // any Markdown symbols, which is preferable to an "unsupported" error.
  return { ext: 'txt', mimeType: 'text/plain' };
}

// ─── Base64 decode ────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

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

    // If the URI is opaque (no recognizable extension), sniff the file content.
    if (!KNOWN_EXTS.has(ext)) {
      // Phase 1 — binary magic bytes (PDF, RTF, EPUB, DOCX)
      // Phase 2 — text content sniff (HTML, SRT, TXT/MD fallback)
      const detected = detectTypeFromBinaryMagic(bytes) ?? detectTypeFromTextContent(bytes);
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
