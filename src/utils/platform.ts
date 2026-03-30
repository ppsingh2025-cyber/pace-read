import { Capacitor } from '@capacitor/core';

/** Returns true when running inside a Capacitor native container (Android or iOS). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Returns true when running on iOS (native only). */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Returns true when running on Android (native only). */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}
