/**
 * Reading Profiles
 *
 * Pre-configured bundles of reader settings for common reading modes.
 * Each profile adjusts WPM, window size, chunking, and feature flags.
 * Users can still override any individual setting after applying a profile.
 *
 * Default profile on first launch: Balanced.
 */

import type { WindowSize, Orientation, ChunkMode } from '../context/readerContextDef';

export interface ReadingProfile {
  id: string;
  name: string;
  /** Short description shown as a tooltip */
  description: string;
  wpm: number;
  windowSize: WindowSize;
  orientation: Orientation;
  highlightColor: string;
  chunkMode: ChunkMode;
  peripheralFade: boolean;
  punctuationPause: boolean;
  longWordCompensation: boolean;
  mainWordFontSize: number;
}

export const READING_PROFILES: ReadingProfile[] = [
  {
    id: 'max-speed',
    name: 'Max Speed',
    description: 'Extreme speed for document triage — preview, not deep reading',
    wpm: 700,
    windowSize: 1,
    orientation: 'horizontal',
    highlightColor: '#e74c3c',
    chunkMode: 'fixed',
    peripheralFade: false,
    punctuationPause: false,
    longWordCompensation: false,
    mainWordFontSize: 150,
  },
  {
    id: 'sprint',
    name: 'Sprint',
    description: 'Push your limits — structured speed training in short bursts',
    wpm: 500,
    windowSize: 1,
    orientation: 'horizontal',
    highlightColor: '#f39c12',
    chunkMode: 'fixed',
    peripheralFade: false,
    punctuationPause: false,
    longWordCompensation: false,
    mainWordFontSize: 130,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Everyday reading — articles, emails, general content',
    wpm: 300,
    windowSize: 3,
    orientation: 'horizontal',
    highlightColor: '#e74c3c',
    chunkMode: 'fixed',
    peripheralFade: true,
    punctuationPause: true,
    longWordCompensation: true,
    mainWordFontSize: 100,
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Full concentration — textbooks, reports, important documents',
    wpm: 180,
    windowSize: 3,
    orientation: 'horizontal',
    highlightColor: '#3498db',
    chunkMode: 'fixed',
    peripheralFade: true,
    punctuationPause: true,
    longWordCompensation: true,
    mainWordFontSize: 120,
  },
  {
    id: 'zen',
    name: 'Zen',
    description: 'Slow, intentional, meditative — poetry, philosophy, reflective reading',
    wpm: 100,
    windowSize: 1,
    orientation: 'horizontal',
    highlightColor: '#9b59b6',
    chunkMode: 'intelligent',
    peripheralFade: false,
    punctuationPause: true,
    longWordCompensation: true,
    mainWordFontSize: 180,
  },
];

export const DEFAULT_PROFILE_ID = 'balanced';
export const LS_KEY_PROFILE = 'fastread_reading_profile';
