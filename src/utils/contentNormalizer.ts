/**
 * contentNormalizer
 *
 * Implements Stages 3 and 4 of the 4-stage ingestion pipeline:
 *
 *   Stage 1 — Raw extraction     (handled by parsers: pdfParser, epubParser, textParser)
 *   Stage 2 — Structural segmentation (pages/lines; pdfParser preserves EOL, callers split)
 *   Stage 3 — Header/footer classification  ← this module
 *   Stage 4 — Normalized content build      ← this module
 *
 * The normalizer runs ONCE per file load, before tokenization, and must NOT
 * run during reading playback (enforced by callers in App.tsx).
 *
 * Classification algorithm (for paginated sources with ≥2 pages):
 *   • For each page the top ZONE_DEPTH and bottom ZONE_DEPTH non-empty lines
 *     form the header/footer candidate zones.
 *   • A zone-position is classified as "repeating" if the texts collected
 *     across all pages at that position:
 *       1. Appear on >50 % of pages (FREQUENCY_THRESHOLD).
 *       2. Are short (< MAX_HEADER_LENGTH characters).
 *       3. Are NOT highly diverse — if ≥60 % of the values are unique, the
 *          line is a series of distinct elements (chapter titles, etc.) rather
 *          than a repeating header/footer.
 *       4. Satisfy at least one structural guard:
 *            a. Mostly uppercase (≥75 % of letters are uppercase)
 *            b. Numeric / punctuation only
 *            c. Matches a known page-header pattern (e.g. "Page N", "N/N")
 *          OR pass a bigram-similarity cluster test (≥85 % average similarity).
 *   • Scene separators (***, ———) are never suppressed.
 *   • Lines longer than MAX_HEADER_LENGTH are never suppressed.
 *   • Lines appearing only once across ALL pages are never suppressed.
 *   • Standalone page-number lines (pure integers, "Page N", "N/N") are
 *     removed regardless of frequency.
 *
 * Inline contamination removal (Stage 4 post-processing):
 *   After whole-line classification, body lines that survived suppression are
 *   scanned for inline contamination — fragments the PDF extractor injected
 *   mid-sentence rather than on a separate line.  Two kinds are removed:
 *     1. Page-counter patterns (e.g. "4 of 967", "Page 42") validated against
 *        the document's page count to avoid removing legitimate numeric prose.
 *     2. Identified running-header fragments (e.g. "Crime and Punishment")
 *        found inline in body lines.
 *
 * Performance: O(n) in total line count; no nested heavy loops over the full
 * document. Safe for 100k+ word novels.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface NormalizationStats {
  totalLines: number;
  suppressedHeaders: number;
  suppressedFooters: number;
  suppressedPageNumbers: number;
  /** Inline header/page-counter fragments removed from body lines */
  suppressedInlineContamination: number;
  /** Populated only when debug=true */
  classificationLog?: string[];
}

// ─── Tuneable constants ───────────────────────────────────────────────────────

/** Lines longer than this are NEVER classified as repeating headers/footers. */
const MAX_HEADER_LENGTH = 60;

/**
 * How many lines from the top/bottom of each page form the candidate zone.
 * Keeping this small (2) limits the risk of accidentally suppressing real body text.
 */
const ZONE_DEPTH = 2;

/**
 * A candidate must appear on at least this fraction of pages to be classified
 * as a repeating element.
 */
const FREQUENCY_THRESHOLD = 0.5;

/**
 * Minimum bigram-Dice similarity for two lines to be considered the same
 * recurring element.
 */
const SIMILARITY_THRESHOLD = 0.85;

/**
 * If this fraction (or more) of zone-position texts are unique, the position
 * is considered a series of distinct labels (chapter titles, etc.) and is
 * NOT suppressed.
 */
const DIVERSITY_GUARD = 0.6;

/**
 * Minimum character length for a header fragment to be removed when found
 * inline inside a body line.  Too-short fragments risk false positives.
 */
const MIN_INLINE_FRAGMENT_LENGTH = 4;

// ─── Inline contamination patterns ───────────────────────────────────────────

/** Matches "N of M" page-counter patterns embedded mid-sentence. */
const N_OF_M_RE = /\b(\d+)\s+of\s+(\d+)\b/gi;

/** Matches "Page N" page-counter patterns embedded mid-sentence. */
const PAGE_N_RE = /\bPage\s+(\d+)\b/gi;

/**
 * Cache of compiled RegExp objects for header fragment removal.
 * Keyed by the lowercased fragment text; avoids recompiling on every line.
 */
const fragmentRegExpCache = new Map<string, RegExp>();

// ─── Page-number patterns ─────────────────────────────────────────────────────

const PAGE_NUMBER_PATTERNS = [
  /^\s*\d+\s*$/,
  /^\s*[Pp]age\s+\d+\s*$/,
  /^\s*\d+\s*\/\s*\d+\s*$/,
];

function isPageNumberLine(line: string): boolean {
  return PAGE_NUMBER_PATTERNS.some((re) => re.test(line));
}

// ─── Scene-separator guard ────────────────────────────────────────────────────

const SCENE_SEPARATOR_RE = /^(\*{3,}|[-–—]{3,}|_{3,}|[•·]{3,}|\*\s*\*\s*\*)$/;

function isSceneSeparator(line: string): boolean {
  return SCENE_SEPARATOR_RE.test(line.trim());
}

// ─── Inline contamination removal ────────────────────────────────────────────

/**
 * Remove inline page-counter fragments that match page-progression logic.
 *
 * Validates the detected numbers against `totalPages` so legitimate numeric
 * prose (e.g. "3 of 5 apples") is not accidentally removed.
 *
 * Handles:
 *   • "N of M"  — e.g. "4 of 967"  (pdfjs running counter injection)
 *   • "Page N"  — e.g. "Page 42"
 */
function removeInlinePageCounters(text: string, totalPages: number): string {
  let result = text;

  // "N of M" — only strip when M is within ±20 % of the document's page count
  result = result.replace(N_OF_M_RE, (match, p1, p2) => {
    const page = parseInt(p1, 10);
    const total = parseInt(p2, 10);
    if (
      total >= Math.max(2, Math.round(totalPages * 0.8)) &&
      total <= Math.round(totalPages * 1.2) &&
      page >= 1 &&
      page <= total
    ) {
      return '';
    }
    return match;
  });

  // "Page N" — strip when N falls within the valid page range
  result = result.replace(PAGE_N_RE, (match, p1) => {
    const page = parseInt(p1, 10);
    if (page >= 1 && page <= totalPages) return '';
    return match;
  });

  return result.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Remove inline occurrences of identified header/footer fragments.
 *
 * Only targets fragments that were classified as repeating headers/footers
 * (i.e. already present in the global suppression set).  Fragments shorter
 * than MIN_INLINE_FRAGMENT_LENGTH are skipped to avoid false positives on
 * common short words.
 */
function removeInlineHeaderFragments(
  text: string,
  fragments: ReadonlySet<string>,
): string {
  let result = text;
  for (const fragment of fragments) {
    if (fragment.length < MIN_INLINE_FRAGMENT_LENGTH) continue;
    let re = fragmentRegExpCache.get(fragment);
    if (!re) {
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp('\\s*' + escaped + '\\s*', 'gi');
      fragmentRegExpCache.set(fragment, re);
    }
    result = result.replace(re, ' ');
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ─── Lightweight bigram-Dice similarity ──────────────────────────────────────

/**
 * Normalized bigram Dice coefficient.  Returns a value in [0, 1].
 * O(n) in string length; no heavy NLP required.
 */
function strSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb) return 1.0;
  if (na.length < 2 || nb.length < 2) return 0.0;
  const ba = new Set<string>();
  const bb = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) ba.add(na.slice(i, i + 2));
  for (let i = 0; i < nb.length - 1; i++) bb.add(nb.slice(i, i + 2));
  let intersection = 0;
  for (const bg of ba) {
    if (bb.has(bg)) intersection++;
  }
  return (2 * intersection) / (ba.size + bb.size);
}

// ─── Line classifiers ─────────────────────────────────────────────────────────

function isMostlyUppercase(line: string): boolean {
  const letters = line.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;
  const upperCount = (line.match(/[A-Z]/g) ?? []).length;
  return upperCount / letters.length >= 0.75;
}

function isNumericLine(line: string): boolean {
  return /^\s*[\d\s.,;:–—-]+\s*$/.test(line);
}

function matchesPageHeaderPattern(line: string): boolean {
  return /^\s*[Pp]age\s+\d+/i.test(line) || /^\s*\d+\s*(of|\/)\s*\d+/i.test(line);
}

/** Returns true if the line can be classified as a structural guard by content alone. */
function isStructuralCandidate(line: string): boolean {
  return isMostlyUppercase(line) || isNumericLine(line) || matchesPageHeaderPattern(line);
}

// ─── Core classifier ──────────────────────────────────────────────────────────

/**
 * Decide whether a collection of texts (one per page, same zone-position)
 * should be suppressed as a repeating header/footer.
 *
 * @param texts       - Trimmed text collected at one zone-position across pages
 * @param totalPages  - Total number of pages in the document
 */
function shouldSuppressZone(texts: string[], totalPages: number): boolean {
  // 1. Frequency guard: must appear on >50 % of pages
  if (texts.length < totalPages * FREQUENCY_THRESHOLD) return false;

  const rep = texts[0];

  // 2. Length guard: protect long descriptive headers
  if (rep.length >= MAX_HEADER_LENGTH) return false;

  // 3. Protect scene separators explicitly
  if (isSceneSeparator(rep)) return false;

  // 4. Diversity guard: if most texts are unique, it's a series (chapter
  //    titles, etc.) rather than a repeating element — do NOT suppress.
  const uniqueCount = new Set(texts.map((t) => t.toLowerCase().trim())).size;
  if (uniqueCount / texts.length >= DIVERSITY_GUARD) return false;

  // 5. Structural-candidate check (uppercase / numeric / known pattern)
  if (isStructuralCandidate(rep)) return true;

  // 6. Similarity cluster check: a majority of texts must resemble the rep.
  const similarCount = texts.filter((t) => strSimilarity(t, rep) >= SIMILARITY_THRESHOLD).length;
  return similarCount >= texts.length * FREQUENCY_THRESHOLD;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalize an array of raw page strings (one element per page/chapter) by:
 *   • Classifying and removing repeating headers and footers.
 *   • Removing standalone page-number lines.
 *   • Forwarding only body content to the caller for tokenization.
 *
 * @param rawPages - One string per page; embedded `\n` characters separate lines.
 * @param debug    - When true, logs classification decisions to the console and
 *                   populates `stats.classificationLog`.  Toggle off in production.
 * @returns `{ normalizedPages, stats }` — pages with headers/footers removed,
 *          plus diagnostic counts.
 */
export function normalizePages(
  rawPages: string[],
  debug = false,
): { normalizedPages: string[]; stats: NormalizationStats } {
  const stats: NormalizationStats = {
    totalLines: 0,
    suppressedHeaders: 0,
    suppressedFooters: 0,
    suppressedPageNumbers: 0,
    suppressedInlineContamination: 0,
    classificationLog: debug ? [] : undefined,
  };

  // ── Not enough pages for frequency analysis ──────────────────────────────
  // With fewer than 2 pages there is no repetition to detect.  Only strip
  // standalone page-number lines (safe even on single-page documents).
  if (rawPages.length < 2) {
    const normalizedPages = rawPages.map((page) => {
      const lines = page.split('\n');
      stats.totalLines += lines.length;
      return lines
        .filter((line) => {
          if (isPageNumberLine(line.trim())) {
            stats.suppressedPageNumbers++;
            if (debug) stats.classificationLog!.push(`PAGE_NUMBER suppressed: "${line.trim()}"`);
            return false;
          }
          return true;
        })
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.length === 0) return line;
          const cleaned = removeInlinePageCounters(trimmed, rawPages.length);
          if (cleaned !== trimmed) {
            stats.suppressedInlineContamination++;
            if (debug) stats.classificationLog!.push(`INLINE_COUNTER removed in: "${trimmed}" → "${cleaned}"`);
          }
          return cleaned;
        })
        .join('\n');
    });
    return { normalizedPages, stats };
  }

  const totalPages = rawPages.length;

  // ── Stage 2: split each page into lines ──────────────────────────────────
  const pagesAsLines: string[][] = rawPages.map((page) => page.split('\n'));
  for (const lines of pagesAsLines) stats.totalLines += lines.length;

  // ── Stage 3: header/footer classification ────────────────────────────────
  //
  // For each zone-position (top 0…ZONE_DEPTH-1, bottom 0…ZONE_DEPTH-1),
  // collect the trimmed text that appears at that position across all pages.
  //
  // topZoneLines[pos]    — texts at position `pos` from the TOP of each page
  // bottomZoneLines[pos] — texts at position `pos` from the BOTTOM of each page

  const topZoneLines: string[][] = Array.from({ length: ZONE_DEPTH }, () => []);
  const bottomZoneLines: string[][] = Array.from({ length: ZONE_DEPTH }, () => []);

  for (const lines of pagesAsLines) {
    const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);

    // Top zone: first ZONE_DEPTH non-empty lines
    for (let pos = 0; pos < ZONE_DEPTH; pos++) {
      if (pos < nonEmpty.length) {
        topZoneLines[pos].push(nonEmpty[pos]);
      }
    }

    // Bottom zone: last ZONE_DEPTH non-empty lines.
    // Use idx >= ZONE_DEPTH to prevent overlap with the top zone on short pages.
    for (let pos = 0; pos < ZONE_DEPTH; pos++) {
      const idx = nonEmpty.length - 1 - pos;
      if (idx >= ZONE_DEPTH) {
        bottomZoneLines[pos].push(nonEmpty[idx]);
      }
    }
  }

  // Decide which zone-positions to suppress
  const suppressTop: boolean[] = topZoneLines.map((texts, pos) => {
    const suppress = shouldSuppressZone(texts, totalPages);
    if (suppress && debug) {
      stats.classificationLog!.push(
        `HEADER[pos=${pos}] classified for suppression: "${texts[0]}" (${texts.length}/${totalPages} pages)`,
      );
    }
    return suppress;
  });

  const suppressBottom: boolean[] = bottomZoneLines.map((texts, pos) => {
    const suppress = shouldSuppressZone(texts, totalPages);
    if (suppress && debug) {
      stats.classificationLog!.push(
        `FOOTER[pos=${pos}] classified for suppression: "${texts[0]}" (${texts.length}/${totalPages} pages)`,
      );
    }
    return suppress;
  });

  // ── Build global inline-suppression fragment set ──────────────────────────
  //
  // Collects all unique header/footer texts that were classified for
  // suppression so that inline occurrences (fragments injected mid-sentence by
  // the PDF extractor) can also be stripped from body lines.
  const inlineSuppressionFragments = new Set<string>();
  for (let pos = 0; pos < ZONE_DEPTH; pos++) {
    if (suppressTop[pos]) {
      for (const t of topZoneLines[pos]) {
        const norm = t.trim().toLowerCase();
        if (norm.length >= MIN_INLINE_FRAGMENT_LENGTH) inlineSuppressionFragments.add(norm);
      }
    }
    if (suppressBottom[pos]) {
      for (const t of bottomZoneLines[pos]) {
        const norm = t.trim().toLowerCase();
        if (norm.length >= MIN_INLINE_FRAGMENT_LENGTH) inlineSuppressionFragments.add(norm);
      }
    }
  }

  // ── Stage 4: normalized content build ────────────────────────────────────

  const normalizedPages: string[] = pagesAsLines.map((lines) => {
    const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);

    // Build separate header/footer suppression sets for accurate stats tracking.
    // Using distinct sets avoids misclassifying a footer as a header when the
    // same text appears in both the top and bottom zone of a page.
    const topSuppressionSet = new Set<string>();
    const bottomSuppressionSet = new Set<string>();

    for (let pos = 0; pos < ZONE_DEPTH; pos++) {
      if (suppressTop[pos] && pos < nonEmpty.length) {
        topSuppressionSet.add(nonEmpty[pos]);
      }
    }
    for (let pos = 0; pos < ZONE_DEPTH; pos++) {
      const idx = nonEmpty.length - 1 - pos;
      if (suppressBottom[pos] && idx >= ZONE_DEPTH) {
        bottomSuppressionSet.add(nonEmpty[idx]);
      }
    }
    const pageSuppressionSet = new Set<string>([...topSuppressionSet, ...bottomSuppressionSet]);

    // Filter lines, keeping only body content
    const bodyLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();

      // Always pass through empty lines (preserve paragraph spacing)
      if (trimmed.length === 0) {
        bodyLines.push(line);
        continue;
      }

      // ── Page number: standalone integer / "Page N" / "N/N" ──────────────
      if (isPageNumberLine(trimmed)) {
        stats.suppressedPageNumbers++;
        if (debug) stats.classificationLog!.push(`PAGE_NUMBER suppressed: "${trimmed}"`);
        continue;
      }

      // ── Exact match against the page suppression set ─────────────────────
      if (pageSuppressionSet.has(trimmed)) {
        // Use the separate zone sets to accurately classify header vs footer
        if (topSuppressionSet.has(trimmed) && !bottomSuppressionSet.has(trimmed)) {
          stats.suppressedHeaders++;
          if (debug) stats.classificationLog!.push(`HEADER suppressed (exact): "${trimmed}"`);
        } else if (bottomSuppressionSet.has(trimmed) && !topSuppressionSet.has(trimmed)) {
          stats.suppressedFooters++;
          if (debug) stats.classificationLog!.push(`FOOTER suppressed (exact): "${trimmed}"`);
        } else {
          // Appears in both zones — count as header for stats
          stats.suppressedHeaders++;
          if (debug) stats.classificationLog!.push(`HEADER/FOOTER suppressed (exact): "${trimmed}"`);
        }
        continue;
      }

      // ── Similarity-based suppression for slight variations ───────────────
      // Handles running headers that include varying page-embedded text while
      // still being mostly the same (e.g. "Chapter 3 — Title" vs "Chapter 4 — Title").
      // Only applies to short lines to avoid performance impact.
      if (trimmed.length < MAX_HEADER_LENGTH) {
        let suppressedBySimilarity = false;
        for (const suppressed of pageSuppressionSet) {
          if (strSimilarity(trimmed, suppressed) >= SIMILARITY_THRESHOLD) {
            suppressedBySimilarity = true;
            break;
          }
        }
        if (suppressedBySimilarity) {
          stats.suppressedHeaders++;
          if (debug) {
            stats.classificationLog!.push(`HEADER suppressed (similar): "${trimmed}"`);
          }
          continue;
        }
      }

      bodyLines.push(line);
    }

    // Apply inline contamination removal to surviving body lines.
    // This strips header fragments and page counters that the PDF extractor
    // injected mid-sentence (e.g. "Crime and Punishment 4 of 967").
    const cleanedBodyLines = bodyLines.map((bl) => {
      const trimmed = bl.trim();
      if (trimmed.length === 0) return bl;

      let cleaned = removeInlinePageCounters(trimmed, totalPages);
      cleaned = removeInlineHeaderFragments(cleaned, inlineSuppressionFragments);

      if (cleaned !== trimmed) {
        stats.suppressedInlineContamination++;
        if (debug) {
          stats.classificationLog!.push(
            `INLINE_CONTAMINATION removed: "${trimmed}" → "${cleaned}"`,
          );
        }
      }
      return cleaned;
    });

    return cleanedBodyLines.join('\n');
  });

  if (debug) {
    console.debug('[contentNormalizer] Normalization complete:', {
      pages: totalPages,
      totalLines: stats.totalLines,
      suppressedHeaders: stats.suppressedHeaders,
      suppressedFooters: stats.suppressedFooters,
      suppressedPageNumbers: stats.suppressedPageNumbers,
      suppressedInlineContamination: stats.suppressedInlineContamination,
    });
    if (stats.classificationLog && stats.classificationLog.length > 0) {
      console.debug('[contentNormalizer] Classification log:\n' + stats.classificationLog.join('\n'));
    }
  }

  return { normalizedPages, stats };
}
