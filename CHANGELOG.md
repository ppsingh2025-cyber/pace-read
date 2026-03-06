# Changelog

## [1.0.3]
### Changed
- Maximum word window reduced from 5 to 3
- Word layout redesigned: ORP character always aligned with tick marks
- Pre-ORP column fixed at 3 character widths — accommodates any English word
- Tick position derived from font metrics, identical in 1-word and multi-word mode
- Both modes share same left edge and ORP anchor point

## [1.0.2]
### Fixed
- Single-word mode now left-aligned — same starting X as multi-word mode
- Tick marks completely static — never move between words in either mode
- Tick position computed once from font metrics, only updates on font size change
- Context words flow at natural width — no equal-width columns, no mid-word clipping
- Empty trailing slots removed from DOM (null), no layout gaps
- Focal ticks hidden when no document loaded
- focalLine new-user default corrected to false

## [1.0.1]
### Fixed
- Ellipsis shown only on last context word slot
- Focal tick marks restored in multi-word mode via ORP position measurement
- Empty trailing slots invisible and take no space
- Context panel collapsed by default, tap to expand
- focalLine always colors ORP regardless of orpEnabled toggle
- Viewport vertically centered, words no longer float
- Context word font size increased for mobile readability
- Punctuation pause: sentence-end only (1.25×), minor punctuation removed
