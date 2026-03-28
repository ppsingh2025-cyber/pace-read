/**
 * platform.ts
 *
 * Lightweight runtime platform detection using the Capacitor core API.
 * Avoids importing the full Capacitor bundle in non-native environments.
 *
 * All native-feature guards in the app should use these helpers rather than
 * reading import.meta.env.VITE_IS_NATIVE at runtime — the env flag is a
 * build-time hint for tree-shaking; the runtime check is what actually matters.
 */

import { Capacitor } from '@capacitor/core';

/** True when running inside a Capacitor native shell (Android or iOS). */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Returns 'android' | 'ios' | 'web'. */
export const getPlatform = (): string => Capacitor.getPlatform();

/** True only when running on iOS native. */
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

/** True only when running on Android native. */
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
