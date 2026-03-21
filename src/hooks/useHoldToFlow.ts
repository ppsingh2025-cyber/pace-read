/**
 * useHoldToFlow
 *
 * Press-and-hold auto-repeat with 3-phase acceleration for word navigation.
 * A single tap fires onStep() immediately with zero latency.
 * Holding the button triggers continuous auto-advance that accelerates over time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

const HOLD_TRIGGER_MS   = 300;   // ms before auto-repeat begins
const PHASE_1_INTERVAL  = 220;   // ms/step in phase 1 (~270 WPM pace)
const PHASE_2_THRESHOLD = 1500;  // ms total hold to enter phase 2
const PHASE_2_INTERVAL  = 100;   // ms/step in phase 2 (~600 WPM pace)
const PHASE_3_THRESHOLD = 3000;  // ms total hold to enter phase 3
const PHASE_3_INTERVAL  = 45;    // ms/step in phase 3 (~1300 WPM scrub)

interface UseHoldToFlowOptions {
  onStep: () => void;
  disabled: boolean;
}

interface HoldToFlowHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp:   (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  'data-holding': boolean;
}

export function useHoldToFlow(options: UseHoldToFlowOptions): HoldToFlowHandlers {
  const { onStep, disabled } = options;

  const isHolding     = useRef<boolean>(false);
  const holdStartTime = useRef<number>(0);
  const currentPhase  = useRef<1 | 2 | 3>(1);
  const timeoutId     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalId    = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStepRef     = useRef<() => void>(onStep);

  // Keep onStepRef current after each render so interval callbacks stay fresh
  useEffect(() => {
    onStepRef.current = onStep;
  });

  const [isHoldingState, setIsHoldingState] = useState<boolean>(false);

  const stopHold = useCallback(() => {
    isHolding.current = false;
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    setIsHoldingState(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStepRef.current();
    isHolding.current = true;
    holdStartTime.current = Date.now();
    currentPhase.current = 1;

    // startInterval is a plain local function — defined inside the event handler
    // so it can call itself recursively without hook rules applying to it.
    const startInterval = (intervalMs: number) => {
      if (intervalId.current !== null) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      intervalId.current = setInterval(() => {
        if (!isHolding.current) {
          if (intervalId.current !== null) {
            clearInterval(intervalId.current);
            intervalId.current = null;
          }
          return;
        }
        const elapsed = Date.now() - holdStartTime.current;
        if (elapsed >= PHASE_3_THRESHOLD && currentPhase.current !== 3) {
          if (intervalId.current !== null) {
            clearInterval(intervalId.current);
            intervalId.current = null;
          }
          currentPhase.current = 3;
          startInterval(PHASE_3_INTERVAL);
          return;
        }
        if (elapsed >= PHASE_2_THRESHOLD && currentPhase.current !== 2 && currentPhase.current !== 3) {
          if (intervalId.current !== null) {
            clearInterval(intervalId.current);
            intervalId.current = null;
          }
          currentPhase.current = 2;
          startInterval(PHASE_2_INTERVAL);
          return;
        }
        onStepRef.current();
      }, intervalMs);
    };

    timeoutId.current = setTimeout(() => {
      timeoutId.current = null;
      if (!isHolding.current) return;
      setIsHoldingState(true);
      startInterval(PHASE_1_INTERVAL);
    }, HOLD_TRIGGER_MS);
  }, [disabled]);

  useEffect(() => {
    return () => {
      stopHold();
    };
  }, [stopHold]);

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    'data-holding': isHoldingState,
  };
}
