/**
 * ReadingModes
 *
 * Compact horizontal tab row: Speed | Focus | Read | Custom
 *
 * Preset tabs (Speed / Focus / Read) apply a full bundle of settings with one tap
 * and show a one-line description below.
 *
 * Custom tab shows:
 *   - Saved mode chips (max 3, each tappable + deletable)
 *   - All 7 individual toggles inline for direct adjustment
 *   - "＋ Save current settings" button to open the wizard
 */

import { useState } from 'react';
import { useReaderContext } from '../context/useReaderContext';
import { PRESET_MODES } from '../config/readingModePresets';
import type { PresetModeId, CustomMode } from '../types/readingModes';
import type { WindowSize } from '../context/readerContextDef';
import SaveModeWizard from './SaveModeWizard';
import styles from '../styles/ReadingModes.module.css';

export default function ReadingModes() {
  const {
    activeMode,
    setActiveMode,
    activeCustomModeId,
    setActiveCustomModeId,
    savedCustomModes,
    setSavedCustomModes,
    selectPresetMode,
    selectCustomMode,
    // Individual settings (for Custom panel toggles)
    windowSize,
    setWindowSize,
    orpEnabled,
    setOrpEnabled,
    focalLine,
    setFocalLine,
    peripheralFade,
    setPeripheralFade,
    punctuationPause,
    setPunctuationPause,
    longWordCompensation,
    setLongWordCompensation,
    chunkMode,
    setChunkMode,
  } = useReaderContext();

  const [wizardOpen, setWizardOpen] = useState(false);

  const deleteCustomMode = (mode: CustomMode) => {
    setSavedCustomModes(savedCustomModes.filter((m) => m.id !== mode.id));
    if (activeCustomModeId === mode.id) {
      setActiveCustomModeId(null);
      // Stay in custom mode but now unsaved
    }
  };

  return (
    <>
      {/* ── Tab row ─────────────────────────────────────────────── */}
      <div className={styles.tabRow} role="tablist">
        {(['speed', 'focus', 'read'] as PresetModeId[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeMode === id}
            className={`${styles.tab} ${activeMode === id ? styles.tabActive : ''}`}
            onClick={() => selectPresetMode(id)}
          >
            {PRESET_MODES[id].icon} {PRESET_MODES[id].label}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={activeMode === 'custom'}
          className={`${styles.tab} ${activeMode === 'custom' ? styles.tabActive : ''}`}
          onClick={() => setActiveMode('custom')}
        >
          ⚙️ Custom
        </button>
      </div>

      {/* ── Active preset description ────────────────────────────── */}
      {activeMode !== 'custom' && (
        <p className={styles.modeDesc}>
          {PRESET_MODES[activeMode as PresetModeId].description}
        </p>
      )}

      {/* ── Custom panel ────────────────────────────────────────── */}
      {activeMode === 'custom' && (
        <div className={styles.customPanel}>

          {/* Saved mode chips */}
          {savedCustomModes.length > 0 && (
            <div className={styles.savedChips}>
              <span className={styles.savedLabel}>Saved</span>
              {savedCustomModes.map((mode) => (
                <div key={mode.id} className={styles.chipRow}>
                  <button
                    className={`${styles.chip} ${activeCustomModeId === mode.id ? styles.chipActive : ''}`}
                    onClick={() => selectCustomMode(mode)}
                    aria-pressed={activeCustomModeId === mode.id}
                  >
                    {activeCustomModeId === mode.id ? '✓ ' : ''}{mode.name}
                  </button>
                  <button
                    className={styles.chipDelete}
                    onClick={() => deleteCustomMode(mode)}
                    aria-label={`Delete "${mode.name}"`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save / full-slots message */}
          {savedCustomModes.length < 3 ? (
            <button className={styles.saveBtn} onClick={() => setWizardOpen(true)}>
              ＋ Save current settings
            </button>
          ) : (
            <p className={styles.savedFull}>3/3 slots used — delete one to save a new mode</p>
          )}

          <hr className={styles.customPanelDivider} />

          {/* All 7 individual toggles */}
          <div className={styles.toggleList}>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Word Window</span>
                <span className={styles.toggleDesc}>Words shown at once</span>
              </span>
              <select
                className={styles.select}
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value) as WindowSize)}
                aria-label="Number of words shown at once"
              >
                {([1, 2, 3, 4, 5] as WindowSize[]).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>ORP Highlight</span>
                <span className={styles.toggleDesc}>Color the key letter</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={orpEnabled}
                onChange={(e) => setOrpEnabled(e.target.checked)}
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Focal Line</span>
                <span className={styles.toggleDesc}>Guide tick marks + letter anchor</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={focalLine}
                onChange={(e) => setFocalLine(e.target.checked)}
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Peripheral Fade</span>
                <span className={styles.toggleDesc}>Dim surrounding words</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={peripheralFade}
                onChange={(e) => setPeripheralFade(e.target.checked)}
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Punctuation Pause</span>
                <span className={styles.toggleDesc}>Brief pause at . , ; :</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={punctuationPause}
                onChange={(e) => setPunctuationPause(e.target.checked)}
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Long Word Slow-down</span>
                <span className={styles.toggleDesc}>Extra time for long words</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={longWordCompensation}
                onChange={(e) => setLongWordCompensation(e.target.checked)}
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleInfo}>
                <span className={styles.toggleName}>Phrase Grouping</span>
                <span className={styles.toggleDesc}>Natural phrase chunks</span>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={chunkMode === 'intelligent'}
                onChange={(e) => setChunkMode(e.target.checked ? 'intelligent' : 'fixed')}
              />
            </label>

          </div>
        </div>
      )}

      {wizardOpen && (
        <SaveModeWizard
          onClose={() => setWizardOpen(false)}
          existingModes={savedCustomModes}
        />
      )}
    </>
  );
}
