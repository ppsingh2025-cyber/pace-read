import { useEffect, useRef } from 'react';

/**
 * useScreenWakeLock
 *
 * Keeps the screen on while `isPlaying` is true.
 *
 * Strategy (in priority order):
 *  1. Capacitor native platform → @capacitor-community/keep-awake
 *  2. Web Screen Wake Lock API  → navigator.wakeLock
 *  3. No-op (silently)
 *
 * All async calls are wrapped in try/catch — the hook never throws.
 * No UI, no toasts, no console output.
 */
export function useScreenWakeLock(isPlaying: boolean): void {
  // Holds the active WakeLockSentinel (web); never stored in state.
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  // Tracks whether a native wake lock is currently held.
  const nativeActiveRef = useRef<boolean>(false);
  // Mirrors the latest isPlaying value for use inside the visibilitychange handler.
  const isPlayingRef = useRef<boolean>(isPlaying);
  // Ref to the active visibilitychange handler so cleanup can remove it.
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Keep the ref in sync with the latest isPlaying value.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let cleanedUp = false;

    /** Acquire the Web Wake Lock sentinel and attach a release listener. */
    const acquireWebSentinel = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cleanedUp) {
          try { await sentinel.release(); } catch { /* ignore */ }
          return;
        }
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
        sentinelRef.current = sentinel;
      } catch {
        // silently ignore (API unavailable or request denied)
      }
    };

    /** Release the Web Wake Lock sentinel if one is held. */
    const releaseWebSentinel = async () => {
      try {
        if (sentinelRef.current) {
          await sentinelRef.current.release();
          sentinelRef.current = null;
        }
      } catch {
        // silently ignore
      }
    };

    const run = async () => {
      // --- Strategy 1: Capacitor native platform ---
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { KeepAwake } = await import('@capacitor-community/keep-awake');

        if (cleanedUp) return;

        if (isPlaying) {
          try {
            await KeepAwake.keepAwake();
            nativeActiveRef.current = true;
          } catch {
            // silently ignore
          }
        } else {
          try {
            await KeepAwake.allowSleep();
            nativeActiveRef.current = false;
          } catch {
            // silently ignore
          }
        }
        // Native platform — visibilitychange listener not needed.
        return;
      }

      // --- Strategy 2: Web Screen Wake Lock API ---
      if (!('wakeLock' in navigator)) return; // Strategy 3: no-op

      if (cleanedUp) return;

      // Attach visibilitychange listener now that we know we're on a web platform.
      // Re-acquires the lock when the page becomes visible again (the OS releases
      // the lock when the tab is hidden or the screen turns off).
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isPlayingRef.current) {
          void acquireWebSentinel();
        }
      };
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);

      if (isPlaying) {
        void acquireWebSentinel();
      } else {
        void releaseWebSentinel();
      }
    };

    void run();

    return () => {
      cleanedUp = true;

      // Remove the web visibilitychange listener if one was registered.
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }

      // Release any active web sentinel.
      if (sentinelRef.current) {
        const s = sentinelRef.current;
        sentinelRef.current = null;
        void (async () => {
          try { await s.release(); } catch { /* silently ignore */ }
        })();
      }

      // Release native wake lock if active.
      if (nativeActiveRef.current) {
        nativeActiveRef.current = false;
        void (async () => {
          try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
              const { KeepAwake } = await import('@capacitor-community/keep-awake');
              await KeepAwake.allowSleep();
            }
          } catch { /* silently ignore */ }
        })();
      }
    };
  }, [isPlaying]);
}

